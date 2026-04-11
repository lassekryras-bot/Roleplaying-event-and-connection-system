import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import {
  migrateLegacyHookToCampaignV2Event,
  migrateLegacyNowToCampaignV2Event,
  migrateLegacyThreadToCampaignV2Event,
} from "./campaignV2EventMigration.js";
import {
  migrateLegacyPatternToCampaignV2Effect,
  seedHarborWantedEffects,
} from "./campaignV2EffectMigration.js";
import { migrateLegacyTimelineSessionToCampaignV2 } from "./campaignV2SessionMigration.js";
import { ensureSeedCampaignFiles } from "./fileCampaignStore.js";

export const DEFAULT_CAMPAIGNS_ROOT = path.join(process.cwd(), "campaigns");
export const DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR = "campaign-v2-shadow";

const CAMPAIGN_V2_SCHEMA_ROOT = path.join(process.cwd(), "schemas", "campaign-v2");
const CAMPAIGN_V2_SCHEMA_FILE_BY_KIND = {
  location: "location.schema.json",
  locationState: "locationState.schema.json",
  session: "session.schema.json",
  event: "event.schema.json",
  effect: "effect.schema.json",
};
const CAMPAIGN_V2_DIRECTORY_BY_KIND = {
  location: "locations",
  locationState: "location-states",
  session: "sessions",
  event: "events",
  effect: "effects",
};
const KNOWN_SOURCE_PREFIXES = ["place-", "entity-", "session-", "hook-", "thread-", "pattern-"];

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
  return values.map(normalizeText).find(Boolean) ?? "";
}

function joinParagraphs(values) {
  const parts = values.map(normalizeText).filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function dedupeStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim() !== ""))];
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeJsonAtomic(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  const tempFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(tempFilePath, json, "utf8");

  try {
    fs.renameSync(tempFilePath, filePath);
  } catch {
    fs.rmSync(filePath, { force: true });
    fs.renameSync(tempFilePath, filePath);
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(directoryPath, { excludeIndex = false } = {}) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .filter((entry) => !excludeIndex || entry.name !== "index.json")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => readJsonFile(path.join(directoryPath, entry.name)));
}

function listDirectoryNames(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function loadLegacyCampaignProject(rootDir, projectId) {
  const projectRoot = path.join(rootDir, projectId);
  const projectFile = path.join(projectRoot, "project.json");
  if (!fs.existsSync(projectFile)) {
    return null;
  }

  return {
    project: readJsonFile(projectFile),
    now: readJsonFile(path.join(projectRoot, "now.json")),
    playerProfiles: readJsonFile(path.join(projectRoot, "player-profiles.json")),
    linkedEntities: Object.fromEntries(
      listJsonFiles(path.join(projectRoot, "entities")).map((entity) => [entity.id, entity]),
    ),
    patterns: listJsonFiles(path.join(projectRoot, "patterns")),
    threads: listJsonFiles(path.join(projectRoot, "threads")),
    manualLinks: fs.existsSync(path.join(projectRoot, "links", "manual-links.json"))
      ? readJsonFile(path.join(projectRoot, "links", "manual-links.json"))
      : [],
  };
}

function loadLegacyGmTimelineProject(rootDir, projectId) {
  const contentRoot = path.join(rootDir, projectId, "gm-timeline");
  const timelineFile = path.join(contentRoot, "timeline.json");

  if (!fs.existsSync(timelineFile)) {
    return null;
  }

  return {
    timeline: readJsonFile(timelineFile),
    sessions: listJsonFiles(path.join(contentRoot, "sessions"), { excludeIndex: true }),
    places: listJsonFiles(path.join(contentRoot, "places"), { excludeIndex: true }),
    hooks: listJsonFiles(path.join(contentRoot, "hooks"), { excludeIndex: true }),
    threadRefs: listJsonFiles(path.join(contentRoot, "threads"), { excludeIndex: true }),
  };
}

function createAjv(schemaRoot = CAMPAIGN_V2_SCHEMA_ROOT) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  const validators = {};
  for (const [kind, fileName] of Object.entries(CAMPAIGN_V2_SCHEMA_FILE_BY_KIND)) {
    const schema = readJsonFile(path.join(schemaRoot, fileName));
    ajv.addSchema(schema);
    validators[kind] = ajv.getSchema(schema.$id);
  }

  return { ajv, validators };
}

function createValidationError(ajv, validator, payload, filePath) {
  return new Error(
    `Generated shadow document ${filePath} failed schema validation.\n${ajv.errorsText(validator.errors, {
      separator: "\n",
    })}\n${JSON.stringify(payload, null, 2)}`,
  );
}

function validateGeneratedDataset(dataset, { schemaRoot = CAMPAIGN_V2_SCHEMA_ROOT } = {}) {
  const { ajv, validators } = createAjv(schemaRoot);

  for (const [kind, documents] of Object.entries({
    location: dataset.locations,
    locationState: dataset.locationStates,
    session: dataset.sessions,
    event: dataset.events,
    effect: dataset.effects,
  })) {
    const validator = validators[kind];
    if (!validator) {
      throw new Error(`Missing validator for generated ${kind} documents.`);
    }

    for (const document of documents) {
      const isValid = validator(document);
      if (!isValid) {
        const relativeFilePath = `${CAMPAIGN_V2_DIRECTORY_BY_KIND[kind]}/${document.id}.json`;
        throw createValidationError(ajv, validator, document, relativeFilePath);
      }
    }
  }
}

function createIdBuilder() {
  const usedIds = new Set();

  return (prefix, preferredSuffix, fallbackValue = prefix) => {
    const normalizedSuffix = slugify(preferredSuffix) || slugify(fallbackValue) || "item";
    let candidate = `${prefix}-${normalizedSuffix}`;
    let suffixIndex = 2;

    while (usedIds.has(candidate)) {
      candidate = `${prefix}-${normalizedSuffix}-${suffixIndex}`;
      suffixIndex += 1;
    }

    usedIds.add(candidate);
    return candidate;
  };
}

function stripKnownPrefix(value) {
  for (const prefix of KNOWN_SOURCE_PREFIXES) {
    if (String(value).startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }

  return String(value ?? "");
}

function buildReadAloudSummary(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return "";
  }

  return `Read-aloud cues: ${sections
    .map((section) =>
      [normalizeText(section.header), normalizeText(section.trigger), normalizeText(section.text)]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean)
    .join("; ")}`;
}

function mapLegacyLocationStatusFromThreads(threads) {
  if (threads.some((thread) => thread.timelineAnchor === "now")) {
    return "active";
  }

  if (threads.some((thread) => thread.timelineAnchor === "future_possible")) {
    return "available";
  }

  if (threads.some((thread) => thread.timelineAnchor === "past")) {
    return "resolved";
  }

  return "available";
}

function mapLegacyLocationStatusFromSessions(sessions) {
  if (sessions.some((session) => session.status === "active")) {
    return "active";
  }

  if (sessions.some((session) => session.status === "planning")) {
    return "available";
  }

  if (sessions.some((session) => session.status === "ended")) {
    return "resolved";
  }

  if (sessions.some((session) => session.status === "archived")) {
    return "archived";
  }

  return "available";
}

function mapLocationStatusToLocationStateStatus(status) {
  switch (status) {
    case "active":
      return "active";
    case "available":
      return "available";
    case "resolved":
      return "resolved";
    case "archived":
      return "archived";
    case "hidden":
    case "inactive":
    default:
      return "draft";
  }
}

function pushRelation(relations, relation) {
  if (!relation?.type || !relation?.targetId) {
    return;
  }

  if (!relations.some((existing) => existing.type === relation.type && existing.targetId === relation.targetId)) {
    relations.push(relation);
  }
}

function createConversionContext(projectId, shadow) {
  const buildId = createIdBuilder();
  return {
    projectId,
    shadow,
    dataset: {
      projectId,
      locations: [],
      locationStates: [],
      sessions: [],
      events: [],
      effects: [],
    },
    summary: {
      projectId,
      outputSubdir: shadow.contentSubdir,
      counts: {
        locations: 0,
        locationStates: 0,
        sessions: 0,
        events: 0,
        effects: 0,
      },
      sources: {
        places: 0,
        locationEntities: 0,
        sessions: 0,
        hooks: 0,
        threads: 0,
        nowMoments: 0,
        patterns: 0,
      },
      locationPreview: [],
      sessionPreview: [],
      warnings: [],
    },
    buildId,
    effectIdByPatternId: new Map(),
    locationIdByPlaceId: new Map(),
    locationIdByEntityId: new Map(),
    placeIdByLocationId: new Map(),
    entityIdByLocationId: new Map(),
    initialLocationStateIdByLocationId: new Map(),
    postMajorVisitLocationStateIdByLocationId: new Map(),
    eventIdByHookId: new Map(),
    eventIdByThreadId: new Map(),
    docById: new Map(),
  };
}

function registerDocument(context, kind, document) {
  context.dataset[`${kind}s`].push(document);
  context.summary.counts[`${kind}s`] += 1;
  context.docById.set(document.id, document);
}

function buildShadowProject({ legacyCampaign, legacyGmTimeline, contentSubdir = DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR }) {
  const context = createConversionContext(legacyCampaign.project.id, {
    contentSubdir,
  });
  const threadsByPatternId = new Map(
    legacyCampaign.patterns.map((pattern) => [
      pattern.id,
      legacyCampaign.threads.filter((thread) => thread.patternId === pattern.id),
    ]),
  );
  const gmSessionsByPlaceId = new Map();
  const gmHooksByPlaceId = new Map();
  const legacyThreadsByEntityId = new Map();
  const gmPlacesById = new Map((legacyGmTimeline?.places ?? []).map((place) => [place.id, place]));

  if (legacyGmTimeline) {
    for (const session of legacyGmTimeline.sessions) {
      for (const placeId of session.placeIds ?? []) {
        const items = gmSessionsByPlaceId.get(placeId) ?? [];
        items.push(session);
        gmSessionsByPlaceId.set(placeId, items);
      }
    }

    for (const hook of legacyGmTimeline.hooks) {
      const items = gmHooksByPlaceId.get(hook.placeId) ?? [];
      items.push(hook);
      gmHooksByPlaceId.set(hook.placeId, items);
    }
  }

  for (const thread of legacyCampaign.threads) {
    for (const entityId of thread.linkedEntityIds ?? []) {
      const items = legacyThreadsByEntityId.get(entityId) ?? [];
      items.push(thread);
      legacyThreadsByEntityId.set(entityId, items);
    }
  }

  if (legacyGmTimeline) {
    for (const place of legacyGmTimeline.places) {
      const locationId = context.buildId("location", stripKnownPrefix(place.id), place.headline);
      const location = {
        id: locationId,
        type: "location",
        campaignId: context.projectId,
        title: place.headline,
        summary: firstNonEmpty(place.description, `Shadow-generated location for ${place.headline}.`),
        tags: dedupeStrings([...(place.tags ?? []), "legacy-place"]),
        relations: [],
      };

      context.locationIdByPlaceId.set(place.id, locationId);
      context.placeIdByLocationId.set(locationId, place.id);
      registerDocument(context, "location", location);
      context.summary.sources.places += 1;
    }
  }

  for (const entity of Object.values(legacyCampaign.linkedEntities)) {
    if (entity.type !== "location") {
      continue;
    }

    const relatedThreads = legacyThreadsByEntityId.get(entity.id) ?? [];
    const locationId = context.buildId(
      "location",
      `entity-${stripKnownPrefix(entity.id)}`,
      entity.name,
    );
    const location = {
      id: locationId,
      type: "location",
      campaignId: context.projectId,
      title: entity.name,
      summary: firstNonEmpty(
        relatedThreads[0]?.playerSummary,
        `Legacy location imported from ${entity.id}.`,
      ),
        tags: dedupeStrings([entity.type, entity.playerVisible ? "shared" : "gm-only", "legacy-entity"]),
        relations: [],
      };

    context.locationIdByEntityId.set(entity.id, locationId);
    context.entityIdByLocationId.set(locationId, entity.id);
    registerDocument(context, "location", location);
    context.summary.sources.locationEntities += 1;
  }

  for (const pattern of legacyCampaign.patterns) {
    const patternThreads = threadsByPatternId.get(pattern.id) ?? [];
    const relatedLocationIds = dedupeStrings(
      patternThreads.flatMap((thread) =>
        (thread.linkedEntityIds ?? [])
          .map((entityId) => context.locationIdByEntityId.get(entityId))
          .filter(Boolean),
      ),
    );
    const singleRelatedLocationId = relatedLocationIds.length === 1 ? relatedLocationIds[0] : null;
    const effectId = context.buildId(
      "effect",
      `pattern-${stripKnownPrefix(pattern.id)}`,
      pattern.title,
    );
    const effect = migrateLegacyPatternToCampaignV2Effect({
      effectId,
      pattern,
      patternThreads,
      scope: singleRelatedLocationId && patternThreads.length === 1 ? "local" : "city",
      relatedLocationId: singleRelatedLocationId,
    });

    context.effectIdByPatternId.set(pattern.id, effectId);
    registerDocument(context, "effect", effect);
    context.summary.sources.patterns += 1;
  }

  if (legacyGmTimeline) {
    const threadRefById = new Map(legacyGmTimeline.threadRefs.map((threadRef) => [threadRef.id, threadRef]));

    for (const hook of legacyGmTimeline.hooks) {
      const locationId = context.locationIdByPlaceId.get(hook.placeId);
      const relatedSessionIds = dedupeStrings(
        (gmSessionsByPlaceId.get(hook.placeId) ?? []).map((session) => session.id),
      );
      const eventId = context.buildId("event", `hook-${stripKnownPrefix(hook.id)}`, hook.headline);
      const event = migrateLegacyHookToCampaignV2Event({
        hook,
        eventId,
        locationId,
        relatedSessionIds,
        relatedThreadTitles: (hook.threadIds ?? []).map((threadId) => threadRefById.get(threadId)?.title ?? threadId),
      });

      context.eventIdByHookId.set(hook.id, eventId);
      registerDocument(context, "event", event);
      context.summary.sources.hooks += 1;
    }
  }

  for (const thread of legacyCampaign.threads) {
    const relatedLocationIds = dedupeStrings(
      (thread.linkedEntityIds ?? [])
        .map((entityId) => context.locationIdByEntityId.get(entityId))
        .filter(Boolean),
    );
    const eventId = context.buildId("event", `thread-${stripKnownPrefix(thread.id)}`, thread.title);
    const event = migrateLegacyThreadToCampaignV2Event({
      thread,
      eventId,
      relatedLocationIds,
      effectId: thread.patternId ? context.effectIdByPatternId.get(thread.patternId) ?? null : null,
    });

    context.eventIdByThreadId.set(thread.id, eventId);
    registerDocument(context, "event", event);
    context.summary.sources.threads += 1;
  }

  const activeSession = legacyGmTimeline?.sessions.find(
    (session) => session.id === legacyGmTimeline.timeline.activeSessionId,
  ) ?? null;
  const activeLocationId = activeSession
    ? context.locationIdByPlaceId.get(
        activeSession.placeIds.find((placeId) => context.locationIdByPlaceId.has(placeId)) ?? "",
      ) ?? null
    : null;
  const nowEvent = migrateLegacyNowToCampaignV2Event({
    now: legacyCampaign.now,
    eventId: context.buildId("event", `now-${context.projectId}`, legacyCampaign.now.title),
    projectName: legacyCampaign.project.name,
    activeSessionId: activeSession?.id ?? null,
    activeLocationId,
  });
  registerDocument(context, "event", nowEvent);
  context.summary.sources.nowMoments += 1;

  const harborUnionYardLocationId = context.locationIdByEntityId.get("entity-union-yard") ?? null;
  if (harborUnionYardLocationId) {
    const seededHarborEffects = seedHarborWantedEffects({
      buildId: context.buildId,
      locationId: harborUnionYardLocationId,
      now: legacyCampaign.now,
      nowEventId: nowEvent.id,
      supportingEventIds: dedupeStrings([
        context.eventIdByThreadId.get("thread-whispers-harbor"),
        context.eventIdByThreadId.get("thread-night-watch"),
      ].filter(Boolean)),
    });

    for (const effect of seededHarborEffects) {
      registerDocument(context, "effect", effect);
    }
  }

  for (const location of context.dataset.locations) {
    const sourcePlaceId = context.placeIdByLocationId.get(location.id) ?? null;
    const sourceEntityId = context.entityIdByLocationId.get(location.id) ?? null;
    const sourcePlace = sourcePlaceId ? gmPlacesById.get(sourcePlaceId) ?? null : null;
    const relatedThreads = sourceEntityId ? legacyThreadsByEntityId.get(sourceEntityId) ?? [] : [];
    const relatedHookEvents = sourcePlaceId
      ? dedupeStrings(
          (gmHooksByPlaceId.get(sourcePlaceId) ?? [])
            .map((hook) => context.eventIdByHookId.get(hook.id))
            .filter(Boolean),
        )
      : [];
    const relatedLegacyThreadEvents = sourceEntityId
      ? dedupeStrings(
          relatedThreads
            .map((thread) => context.eventIdByThreadId.get(thread.id))
            .filter(Boolean),
        )
      : [];
    const locationStateDescription = sourcePlace
      ? joinParagraphs([
          sourcePlace.description,
          buildReadAloudSummary(sourcePlace.readAloudSections),
        ])
      : joinParagraphs([
          relatedThreads.length > 0
            ? `Related legacy threads: ${relatedThreads.map((thread) => thread.title).join(", ")}.`
            : "",
        ]);
    const locationStateStatus = sourcePlace
      ? mapLocationStatusToLocationStateStatus(mapLegacyLocationStatusFromSessions(gmSessionsByPlaceId.get(sourcePlaceId) ?? []))
      : mapLocationStatusToLocationStateStatus(mapLegacyLocationStatusFromThreads(relatedThreads));
    const currentStateSummary =
      firstNonEmpty(
        relatedThreads.length > 0
          ? `Referenced by ${relatedThreads.length} legacy thread${relatedThreads.length === 1 ? "" : "s"}.`
          : "",
        sourcePlace ? `Usable as imported from gm-timeline place ${sourcePlace.id}.` : "",
      ) || "";
    const prepSummary = firstNonEmpty(
      buildReadAloudSummary(sourcePlace?.readAloudSections),
      sourcePlace?.notes,
    );
    const locationStateRelations = [];
    for (const eventId of [...relatedHookEvents, ...relatedLegacyThreadEvents]) {
      pushRelation(locationStateRelations, {
        type: "relatedTo",
        targetId: eventId,
      });
    }
    const locationStateNotes = joinParagraphs([
      locationStateDescription,
      currentStateSummary,
      prepSummary ? `Prep: ${prepSummary}` : "",
      sourcePlace
        ? `Imported from gm-timeline place ${sourcePlace.id}.`
        : sourceEntityId
          ? `Imported from legacy linked entity ${sourceEntityId}.`
          : "",
    ]);

    const locationStateId = context.buildId(
      "location-state",
      `${location.id.replace(/^location-/, "")}-initial`,
      `${location.title} before visit`,
    );
    const locationState = {
      id: locationStateId,
      type: "locationState",
      locationId: location.id,
      title: `${location.title} Before Visit`,
      summary: firstNonEmpty(
        sourcePlace?.description,
        relatedThreads[0]?.playerSummary,
        location.summary,
      ),
      status: locationStateStatus,
      notes: locationStateNotes,
      relations: locationStateRelations,
    };

    context.initialLocationStateIdByLocationId.set(location.id, locationStateId);
    registerDocument(context, "locationState", locationState);
  }

  if (legacyGmTimeline) {
    const eventIdsByPlaceId = new Map(
      legacyGmTimeline.places.map((place) => [
        place.id,
        dedupeStrings(
          (gmHooksByPlaceId.get(place.id) ?? [])
            .map((hook) => context.eventIdByHookId.get(hook.id))
            .filter(Boolean),
        ),
      ]),
    );
    const orderedSessions = legacyGmTimeline.sessions
      .slice()
      .sort((left, right) => left.sequence - right.sequence || left.headline.localeCompare(right.headline));

    for (const [index, session] of orderedSessions.entries()) {
      const primaryPlaceId = session.placeIds.find((placeId) => context.locationIdByPlaceId.has(placeId)) ?? null;
      if (!primaryPlaceId) {
        context.summary.warnings.push(
          `Skipped legacy session ${session.id} because none of its places converted into v2 locations.`,
        );
        continue;
      }

      const primaryLocationId = context.locationIdByPlaceId.get(primaryPlaceId);
      const relatedLocationIds = session.placeIds
        .map((placeId) => context.locationIdByPlaceId.get(placeId))
        .filter(Boolean);
      const relatedEventIds = dedupeStrings(
        session.placeIds.flatMap((placeId) => eventIdsByPlaceId.get(placeId) ?? []),
      );
      const primaryLocation = context.docById.get(primaryLocationId);
      const startingLocationStateId = context.initialLocationStateIdByLocationId.get(primaryLocationId) ?? null;
      let resultingLocationStateId = context.postMajorVisitLocationStateIdByLocationId.get(primaryLocationId) ?? null;

      if (!resultingLocationStateId) {
        const postMajorVisitLocationStateId = context.buildId(
          "location-state",
          `${primaryLocationId.replace(/^location-/, "")}-post-major-visit`,
          `${session.headline} aftermath`,
        );
        const postMajorVisitLocationState = {
          id: postMajorVisitLocationStateId,
          type: "locationState",
          locationId: primaryLocationId,
          title: primaryLocation?.title
            ? `${primaryLocation.title} After Major Visit`
            : `${session.headline} Aftermath`,
          summary: firstNonEmpty(
            session.summary,
            session.expectedDirection,
            `After ${session.headline}`,
          ),
          status: "active",
          notes: joinParagraphs([
            session.expectedDirection,
            session.notes,
            `Generated as a post-major-visit state from legacy session ${session.id}.`,
          ]),
          relations: relatedEventIds.map((eventId) => ({
            type: "relatedTo",
            targetId: eventId,
          })),
        };

        context.postMajorVisitLocationStateIdByLocationId.set(primaryLocationId, postMajorVisitLocationStateId);
        resultingLocationStateId = postMajorVisitLocationStateId;
        registerDocument(context, "locationState", postMajorVisitLocationState);
      }

      const sessionDocument = migrateLegacyTimelineSessionToCampaignV2({
        legacySession: session,
        locationId: primaryLocationId,
        previousSessionId: index > 0 ? orderedSessions[index - 1].id : null,
        relatedEventIds,
        relatedLocationIds,
        startingLocationStateId,
        resultingLocationStateId,
      });

      registerDocument(context, "session", sessionDocument);
      context.summary.sources.sessions += 1;

      if ((session.placeIds ?? []).length > 1) {
        context.summary.warnings.push(
          `Legacy session ${session.id} referenced ${session.placeIds.length} places; the shadow model uses ${primaryLocationId} as the primary location.`,
        );
      }
    }
  }

  for (const link of legacyCampaign.manualLinks ?? []) {
    const sourceId =
      context.eventIdByThreadId.get(link.sourceId) ??
      context.effectIdByPatternId.get(link.sourceId) ??
      null;
    const targetId =
      context.eventIdByThreadId.get(link.targetId) ??
      context.effectIdByPatternId.get(link.targetId) ??
      null;

    if (!sourceId || !targetId) {
      continue;
    }

    const sourceDoc = context.docById.get(sourceId);
    if (!sourceDoc) {
      continue;
    }

    sourceDoc.relations = Array.isArray(sourceDoc.relations) ? sourceDoc.relations : [];
    pushRelation(sourceDoc.relations, {
      type: "relatedTo",
      targetId,
      note: `Imported from manual link ${link.id}.`,
    });
  }

  context.summary.locationPreview = context.dataset.locations.map((location) => ({
    id: location.id,
    title: location.title,
    parentLocationId: location.parentLocationId ?? null,
  }));
  context.summary.sessionPreview = context.dataset.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    locationId: session.locationId,
  }));

  validateGeneratedDataset(context.dataset);
  return {
    dataset: context.dataset,
    summary: context.summary,
  };
}

function writeShadowDataset(rootDir, projectId, dataset, { contentSubdir = DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR } = {}) {
  const contentRoot = path.join(rootDir, projectId, contentSubdir);

  for (const directoryName of Object.values(CAMPAIGN_V2_DIRECTORY_BY_KIND)) {
    ensureDirectory(path.join(contentRoot, directoryName));
  }

  for (const [kind, directoryName] of Object.entries(CAMPAIGN_V2_DIRECTORY_BY_KIND)) {
    const directoryPath = path.join(contentRoot, directoryName);
    const existingFiles = fs.existsSync(directoryPath)
      ? fs.readdirSync(directoryPath).filter((entry) => entry.endsWith(".json"))
      : [];

    for (const existingFile of existingFiles) {
      fs.rmSync(path.join(directoryPath, existingFile), { force: true });
    }

    for (const document of dataset[`${kind}s`]) {
      writeJsonAtomic(path.join(directoryPath, `${document.id}.json`), document);
    }
  }

  return contentRoot;
}

export function convertCampaignProjectToV2Shadow({
  rootDir = DEFAULT_CAMPAIGNS_ROOT,
  projectId,
  contentSubdir = DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR,
  dryRun = false,
} = {}) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  ensureSeedCampaignFiles(rootDir);

  const legacyCampaign = loadLegacyCampaignProject(rootDir, projectId);
  if (!legacyCampaign) {
    throw new Error(`Project ${projectId} was not found in ${rootDir}.`);
  }

  const legacyGmTimeline = loadLegacyGmTimelineProject(rootDir, projectId);
  const { dataset, summary } = buildShadowProject({
    legacyCampaign,
    legacyGmTimeline,
    contentSubdir,
  });

  const contentRoot = path.join(rootDir, projectId, contentSubdir);
  if (!dryRun) {
    writeShadowDataset(rootDir, projectId, dataset, { contentSubdir });
  }

  return {
    dataset: cloneValue(dataset),
    summary: {
      ...summary,
      contentRoot,
      wroteFiles: !dryRun,
    },
  };
}

export function convertAllCampaignProjectsToV2Shadow({
  rootDir = DEFAULT_CAMPAIGNS_ROOT,
  projectIds = null,
  contentSubdir = DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR,
  dryRun = false,
} = {}) {
  ensureSeedCampaignFiles(rootDir);
  const targetProjectIds = Array.isArray(projectIds) && projectIds.length > 0 ? projectIds : listDirectoryNames(rootDir);

  return targetProjectIds.map((projectId) =>
    convertCampaignProjectToV2Shadow({
      rootDir,
      projectId,
      contentSubdir,
      dryRun,
    }),
  );
}

export function formatCampaignV2ShadowSummary(summary) {
  const warningSuffix =
    summary.warnings.length > 0 ? `, warnings ${summary.warnings.length}` : "";
  const locationPreview = Array.isArray(summary.locationPreview) && summary.locationPreview.length > 0
    ? `, location preview ${summary.locationPreview
        .slice(0, 3)
        .map((location) => location.title)
        .join(" | ")}${summary.locationPreview.length > 3 ? " | ..." : ""}`
    : "";
  const sessionPreview = Array.isArray(summary.sessionPreview) && summary.sessionPreview.length > 0
    ? `, session preview ${summary.sessionPreview
        .slice(0, 3)
        .map((session) => session.title)
        .join(" | ")}${summary.sessionPreview.length > 3 ? " | ..." : ""}`
    : "";
  return `${summary.projectId}: locations ${summary.counts.locations}, locationStates ${summary.counts.locationStates}, sessions ${summary.counts.sessions}, events ${summary.counts.events}, effects ${summary.counts.effects}${warningSuffix}${locationPreview}${sessionPreview}`;
}
