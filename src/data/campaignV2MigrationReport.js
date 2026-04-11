import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

export const DEFAULT_CAMPAIGNS_ROOT = path.join(process.cwd(), "campaigns");
export const DEFAULT_CAMPAIGN_V2_SCHEMA_ROOT = path.join(process.cwd(), "schemas", "campaign-v2");
export const CAMPAIGN_V2_CONTENT_SUBDIRS = ["campaign-v2", "campaign-v2-shadow"];

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

function pluralizeKind(kind) {
  return kind === "locationState" ? "locationStates" : `${kind}s`;
}

function createCountSummary() {
  return {
    locations: 0,
    locationStates: 0,
    sessions: 0,
    events: 0,
    effects: 0,
  };
}

function createIssue({
  code,
  severity,
  message,
  sourceName = null,
  objectId = null,
  targetId = null,
}) {
  return {
    code,
    severity,
    message,
    sourceName,
    objectId,
    targetId,
  };
}

function percentage(covered, total) {
  if (!total) {
    return 100;
  }

  return Math.round((covered / total) * 100);
}

function formatCountSummary(counts) {
  return `locations ${counts.locations}, locationStates ${counts.locationStates}, sessions ${counts.sessions}, events ${counts.events}, effects ${counts.effects}`;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeListDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true });
}

function safeListJsonFiles(directoryPath, { excludeIndex = false } = {}) {
  return safeListDirectory(directoryPath)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .filter((entry) => !excludeIndex || entry.name !== "index.json")
    .sort((left, right) => left.name.localeCompare(right.name));
}

function detectCampaignV2ContentSubdir(projectRoot, preferredContentSubdir = null) {
  const candidates = preferredContentSubdir
    ? [preferredContentSubdir, ...CAMPAIGN_V2_CONTENT_SUBDIRS.filter((entry) => entry !== preferredContentSubdir)]
    : CAMPAIGN_V2_CONTENT_SUBDIRS;

  for (const candidate of candidates) {
    const contentRoot = path.join(projectRoot, candidate);
    if (!fs.existsSync(contentRoot)) {
      continue;
    }

    const hasJsonFiles = Object.values(CAMPAIGN_V2_DIRECTORY_BY_KIND).some((directoryName) =>
      safeListJsonFiles(path.join(contentRoot, directoryName)).length > 0,
    );

    if (hasJsonFiles) {
      return candidate;
    }
  }

  return null;
}

function listProjectIds(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function createAjv(schemaRoot = DEFAULT_CAMPAIGN_V2_SCHEMA_ROOT) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  return Object.fromEntries(
    Object.entries(CAMPAIGN_V2_SCHEMA_FILE_BY_KIND).map(([kind, fileName]) => {
      const schema = readJsonFile(path.join(schemaRoot, fileName));
      return [kind, ajv.compile(schema)];
    }),
  );
}

function loadCampaignMetadata(projectRoot, projectId) {
  const projectFilePath = path.join(projectRoot, "project.json");
  if (!fs.existsSync(projectFilePath)) {
    return {
      id: projectId,
      name: projectId,
      status: "unknown",
    };
  }

  const project = readJsonFile(projectFilePath);
  return {
    id: typeof project.id === "string" ? project.id : projectId,
    name: typeof project.name === "string" ? project.name : projectId,
    status: typeof project.status === "string" ? project.status : "active",
  };
}

function loadV2SourceFiles(contentRoot) {
  const diagnostics = [];
  const filesByKind = {
    location: [],
    locationState: [],
    session: [],
    event: [],
    effect: [],
  };

  for (const [kind, directoryName] of Object.entries(CAMPAIGN_V2_DIRECTORY_BY_KIND)) {
    const directoryPath = path.join(contentRoot, directoryName);
    const entries = safeListJsonFiles(directoryPath);

    for (const entry of entries) {
      const sourceName = `${directoryName}/${entry.name}`;
      const filePath = path.join(directoryPath, entry.name);

      try {
        const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
        filesByKind[kind].push({
          kind,
          sourceName,
          filePath,
          value,
        });
      } catch (error) {
        diagnostics.push(
          createIssue({
            code: "JSON_PARSE_ERROR",
            severity: "error",
            sourceName,
            message: `${sourceName} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
          }),
        );
      }
    }
  }

  return {
    filesByKind,
    diagnostics,
  };
}

function validateV2Files(filesByKind, schemaRoot) {
  const validators = createAjv(schemaRoot);
  const validDocuments = {
    location: [],
    locationState: [],
    session: [],
    event: [],
    effect: [],
  };
  const diagnostics = [];
  const counts = createCountSummary();

  for (const [kind, files] of Object.entries(filesByKind)) {
    const validator = validators[kind];

    for (const file of files) {
      const objectId = typeof file.value?.id === "string" ? file.value.id : null;
      const expectedFileName = objectId ? `${objectId}.json` : null;

      if (expectedFileName && path.posix.basename(file.sourceName) !== expectedFileName) {
        diagnostics.push(
          createIssue({
            code: "ID_CONVENTION_ERROR",
            severity: "error",
            sourceName: file.sourceName,
            objectId,
            message: `${file.sourceName} should be named ${expectedFileName}.`,
          }),
        );
      }

      const isValid = validator(file.value);
      if (!isValid) {
        diagnostics.push(
          createIssue({
            code: "SCHEMA_VALIDATION_ERROR",
            severity: "error",
            sourceName: file.sourceName,
            objectId,
            message: `${file.sourceName} failed ${CAMPAIGN_V2_SCHEMA_FILE_BY_KIND[kind]}: ${validator.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ")}`,
          }),
        );
        continue;
      }

      validDocuments[kind].push(file);
      counts[pluralizeKind(kind)] += 1;
    }
  }

  const seenIds = new Map();
  for (const file of Object.values(validDocuments).flat()) {
    if (seenIds.has(file.value.id)) {
      diagnostics.push(
        createIssue({
          code: "DUPLICATE_ID",
          severity: "error",
          sourceName: file.sourceName,
          objectId: file.value.id,
          message: `${file.value.id} appears in both ${seenIds.get(file.value.id)} and ${file.sourceName}.`,
        }),
      );
      continue;
    }

    seenIds.set(file.value.id, file.sourceName);
  }

  return {
    validDocuments,
    diagnostics,
    counts,
  };
}

function analyzeGraph(validDocuments) {
  const diagnostics = [];
  const inboundLinksById = new Map();
  const documentsById = new Map();

  for (const file of Object.values(validDocuments).flat()) {
    documentsById.set(file.value.id, file);
    inboundLinksById.set(file.value.id, []);
  }

  function recordInbound(targetId, sourceId, sourceName, via) {
    const items = inboundLinksById.get(targetId);
    if (!items) {
      return;
    }

    items.push({ sourceId, sourceName, via });
  }

  function checkTarget({
    sourceFile,
    targetId,
    via,
    expectedKinds = null,
    mismatchMessage = null,
  }) {
    if (!targetId) {
      return null;
    }

    const targetFile = documentsById.get(targetId);
    if (!targetFile) {
      diagnostics.push(
        createIssue({
          code: "MISSING_TARGET_ID",
          severity: "error",
          sourceName: sourceFile.sourceName,
          objectId: sourceFile.value.id,
          targetId,
          message: `${sourceFile.sourceName} references missing target ${targetId} via ${via}.`,
        }),
      );
      return null;
    }

    if (expectedKinds && !expectedKinds.includes(targetFile.kind)) {
      diagnostics.push(
        createIssue({
          code: "BROKEN_RELATION",
          severity: "error",
          sourceName: sourceFile.sourceName,
          objectId: sourceFile.value.id,
          targetId,
          message:
            mismatchMessage ??
            `${sourceFile.sourceName} references ${targetId} via ${via}, but expected ${expectedKinds.join(" or ")}.`,
        }),
      );
      return targetFile;
    }

    recordInbound(targetId, sourceFile.value.id, sourceFile.sourceName, via);
    return targetFile;
  }

  for (const sourceFile of Object.values(validDocuments).flat()) {
    const relations = Array.isArray(sourceFile.value.relations) ? sourceFile.value.relations : [];
    const seenRelations = new Set();

    for (const relation of relations) {
      const relationKey = `${relation.type}::${relation.targetId}`;
      if (seenRelations.has(relationKey)) {
        diagnostics.push(
          createIssue({
            code: "BROKEN_RELATION",
            severity: "error",
            sourceName: sourceFile.sourceName,
            objectId: sourceFile.value.id,
            targetId: relation.targetId,
            message: `${sourceFile.sourceName} contains a duplicate ${relation.type} relation to ${relation.targetId}.`,
          }),
        );
      } else {
        seenRelations.add(relationKey);
      }

      if (relation.targetId === sourceFile.value.id) {
        diagnostics.push(
          createIssue({
            code: "BROKEN_RELATION",
            severity: "error",
            sourceName: sourceFile.sourceName,
            objectId: sourceFile.value.id,
            targetId: relation.targetId,
            message: `${sourceFile.sourceName} contains a self-relation (${relation.type} -> ${relation.targetId}).`,
          }),
        );
      }

      const expectedKinds =
        sourceFile.kind === "effect" && relation.type === "modifies"
          ? ["effect"]
          : sourceFile.kind === "session" && relation.type === "follows"
            ? ["session"]
            : null;
      checkTarget({
        sourceFile,
        targetId: relation.targetId,
        via: `relation ${relation.type}`,
        expectedKinds,
      });
    }

    if (sourceFile.kind === "location") {
      checkTarget({
        sourceFile,
        targetId: sourceFile.value.parentLocationId,
        via: "parentLocationId",
        expectedKinds: ["location"],
      });
    }

    if (sourceFile.kind === "locationState") {
      checkTarget({
        sourceFile,
        targetId: sourceFile.value.locationId,
        via: "locationId",
        expectedKinds: ["location"],
      });
    }

    if (sourceFile.kind === "session") {
      checkTarget({
        sourceFile,
        targetId: sourceFile.value.locationId,
        via: "locationId",
        expectedKinds: ["location"],
      });

      const startingState = checkTarget({
        sourceFile,
        targetId: sourceFile.value.startingLocationStateId,
        via: "startingLocationStateId",
        expectedKinds: ["locationState"],
      });
      if (startingState && startingState.value.locationId !== sourceFile.value.locationId) {
        diagnostics.push(
          createIssue({
            code: "BROKEN_RELATION",
            severity: "error",
            sourceName: sourceFile.sourceName,
            objectId: sourceFile.value.id,
            targetId: startingState.value.id,
            message: `${sourceFile.sourceName} starts from ${startingState.value.id}, but that state belongs to ${startingState.value.locationId} instead of ${sourceFile.value.locationId}.`,
          }),
        );
      }

      const resultingState = checkTarget({
        sourceFile,
        targetId: sourceFile.value.resultingLocationStateId,
        via: "resultingLocationStateId",
        expectedKinds: ["locationState"],
      });
      if (resultingState && resultingState.value.locationId !== sourceFile.value.locationId) {
        diagnostics.push(
          createIssue({
            code: "BROKEN_RELATION",
            severity: "error",
            sourceName: sourceFile.sourceName,
            objectId: sourceFile.value.id,
            targetId: resultingState.value.id,
            message: `${sourceFile.sourceName} results in ${resultingState.value.id}, but that state belongs to ${resultingState.value.locationId} instead of ${sourceFile.value.locationId}.`,
          }),
        );
      }
    }

    if (sourceFile.kind === "event") {
      for (const effectId of sourceFile.value.createdEffectIds ?? []) {
        checkTarget({
          sourceFile,
          targetId: effectId,
          via: "createdEffectIds",
          expectedKinds: ["effect"],
        });
      }
    }
  }

  const warnings = [];

  for (const sourceFile of validDocuments.session) {
    const inboundCount = inboundLinksById.get(sourceFile.value.id)?.length ?? 0;
    const relationCount = (sourceFile.value.relations ?? []).length;
    const hasStateLinks = Boolean(sourceFile.value.startingLocationStateId || sourceFile.value.resultingLocationStateId);

    if (!hasStateLinks && relationCount === 0 && inboundCount === 0) {
      warnings.push(
        createIssue({
          code: "ORPHAN_SESSION",
          severity: "warning",
          sourceName: sourceFile.sourceName,
          objectId: sourceFile.value.id,
          message: `${sourceFile.sourceName} is disconnected from the wider v2 graph beyond its location anchor.`,
        }),
      );
    }
  }

  for (const sourceFile of validDocuments.event) {
    const inboundCount = inboundLinksById.get(sourceFile.value.id)?.length ?? 0;
    const relationCount = (sourceFile.value.relations ?? []).length;
    const createdEffectCount = (sourceFile.value.createdEffectIds ?? []).length;

    if (relationCount === 0 && createdEffectCount === 0 && inboundCount === 0) {
      warnings.push(
        createIssue({
          code: "ORPHAN_EVENT",
          severity: "warning",
          sourceName: sourceFile.sourceName,
          objectId: sourceFile.value.id,
          message: `${sourceFile.sourceName} is not attached to any session, location, effect, or other graph object.`,
        }),
      );
    }
  }

  for (const sourceFile of validDocuments.effect) {
    const inboundCount = inboundLinksById.get(sourceFile.value.id)?.length ?? 0;
    const relationCount = (sourceFile.value.relations ?? []).length;

    if (relationCount === 0 && inboundCount === 0 && sourceFile.value.scope !== "city") {
      warnings.push(
        createIssue({
          code: "ORPHAN_EFFECT",
          severity: "warning",
          sourceName: sourceFile.sourceName,
          objectId: sourceFile.value.id,
          message: `${sourceFile.sourceName} is not scoped or linked into the rest of the v2 graph.`,
        }),
      );
    }
  }

  return {
    diagnostics: [...diagnostics, ...warnings],
  };
}

function listLegacyLocationEntities(projectRoot) {
  return safeListJsonFiles(path.join(projectRoot, "entities")).map((entry) =>
    readJsonFile(path.join(projectRoot, "entities", entry.name)),
  ).filter((entity) => entity?.type === "location");
}

function loadLegacyCounts(rootDir, projectId) {
  const projectRoot = path.join(rootDir, projectId);
  const gmTimelineRoot = path.join(projectRoot, "gm-timeline");

  return {
    places: safeListJsonFiles(path.join(gmTimelineRoot, "places"), { excludeIndex: true }).map((entry) =>
      readJsonFile(path.join(gmTimelineRoot, "places", entry.name)),
    ),
    sessions: safeListJsonFiles(path.join(gmTimelineRoot, "sessions"), { excludeIndex: true }).map((entry) =>
      readJsonFile(path.join(gmTimelineRoot, "sessions", entry.name)),
    ),
    hooks: safeListJsonFiles(path.join(gmTimelineRoot, "hooks"), { excludeIndex: true }).map((entry) =>
      readJsonFile(path.join(gmTimelineRoot, "hooks", entry.name)),
    ),
    locationEntities: listLegacyLocationEntities(projectRoot),
    threads: safeListJsonFiles(path.join(projectRoot, "threads")).map((entry) =>
      readJsonFile(path.join(projectRoot, "threads", entry.name)),
    ),
    patterns: safeListJsonFiles(path.join(projectRoot, "patterns")).map((entry) =>
      readJsonFile(path.join(projectRoot, "patterns", entry.name)),
    ),
    nowMoments: fs.existsSync(path.join(projectRoot, "now.json")) ? [readJsonFile(path.join(projectRoot, "now.json"))] : [],
  };
}

function buildCoverageSummary(validDocuments, legacyCounts) {
  const locationIds = new Set(validDocuments.location.map((file) => file.value.id));
  const locationStateIdsByLocationId = new Map();
  const sessionIds = new Set(validDocuments.session.map((file) => file.value.id));
  const eventIds = new Set(validDocuments.event.map((file) => file.value.id));
  const effectIds = new Set(validDocuments.effect.map((file) => file.value.id));

  for (const file of validDocuments.locationState) {
    const items = locationStateIdsByLocationId.get(file.value.locationId) ?? [];
    items.push(file.value.id);
    locationStateIdsByLocationId.set(file.value.locationId, items);
  }

  const coverageItems = [
    {
      label: "gm-timeline places -> v2 locations",
      covered: legacyCounts.places.filter((place) =>
        locationIds.has(`location-${String(place.id).replace(/^place-/, "")}`),
      ).length,
      total: legacyCounts.places.length,
    },
    {
      label: "legacy location entities -> v2 locations",
      covered: legacyCounts.locationEntities.filter((entity) => locationIds.has(`location-${entity.id}`)).length,
      total: legacyCounts.locationEntities.length,
    },
    {
      label: "gm-timeline sessions -> v2 sessions",
      covered: legacyCounts.sessions.filter((session) => sessionIds.has(session.id)).length,
      total: legacyCounts.sessions.length,
    },
    {
      label: "gm-timeline hooks -> v2 events",
      covered: legacyCounts.hooks.filter((hook) => eventIds.has(`event-${hook.id}`)).length,
      total: legacyCounts.hooks.length,
    },
    {
      label: "legacy threads -> v2 events",
      covered: legacyCounts.threads.filter((thread) => eventIds.has(`event-${thread.id}`)).length,
      total: legacyCounts.threads.length,
    },
    {
      label: "legacy patterns -> v2 effects",
      covered: legacyCounts.patterns.filter((pattern) => effectIds.has(`effect-${pattern.id}`)).length,
      total: legacyCounts.patterns.length,
    },
    {
      label: "legacy now moments -> v2 events",
      covered:
        legacyCounts.nowMoments.length > 0 && [...eventIds].some((eventId) => eventId.startsWith("event-now-"))
          ? 1
          : 0,
      total: legacyCounts.nowMoments.length,
    },
    {
      label: "v2 locations with at least one locationState",
      covered: validDocuments.location.filter((file) => (locationStateIdsByLocationId.get(file.value.id) ?? []).length > 0).length,
      total: validDocuments.location.length,
    },
  ].map((item) => ({
    ...item,
    percent: percentage(item.covered, item.total),
  }));

  return coverageItems;
}

export function validateCampaignV2Project({
  rootDir = DEFAULT_CAMPAIGNS_ROOT,
  schemaRoot = DEFAULT_CAMPAIGN_V2_SCHEMA_ROOT,
  projectId,
  contentSubdir = null,
} = {}) {
  if (!projectId) {
    throw new Error("projectId is required.");
  }

  const projectRoot = path.join(rootDir, projectId);
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`Project ${projectId} was not found in ${rootDir}.`);
  }

  const resolvedContentSubdir = detectCampaignV2ContentSubdir(projectRoot, contentSubdir);
  if (!resolvedContentSubdir) {
    throw new Error(`Project ${projectId} does not contain campaign-v2 or campaign-v2-shadow data.`);
  }

  const contentRoot = path.join(projectRoot, resolvedContentSubdir);
  const metadata = loadCampaignMetadata(projectRoot, projectId);
  const loadResult = loadV2SourceFiles(contentRoot);
  const validationResult = validateV2Files(loadResult.filesByKind, schemaRoot);
  const graphResult = analyzeGraph(validationResult.validDocuments);
  const legacyCounts = loadLegacyCounts(rootDir, projectId);
  const coverage = buildCoverageSummary(validationResult.validDocuments, legacyCounts);
  const issues = [...loadResult.diagnostics, ...validationResult.diagnostics, ...graphResult.diagnostics];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    project: metadata,
    projectId: metadata.id,
    contentSubdir: resolvedContentSubdir,
    contentRoot,
    status: errorCount > 0 ? "fail" : "pass",
    counts: {
      v2: validationResult.counts,
      legacy: {
        places: legacyCounts.places.length,
        locationEntities: legacyCounts.locationEntities.length,
        sessions: legacyCounts.sessions.length,
        hooks: legacyCounts.hooks.length,
        threads: legacyCounts.threads.length,
        patterns: legacyCounts.patterns.length,
        nowMoments: legacyCounts.nowMoments.length,
      },
    },
    coverage,
    issues,
    summary: {
      errorCount,
      warningCount,
    },
  };
}

export function validateCampaignV2Projects({
  rootDir = DEFAULT_CAMPAIGNS_ROOT,
  schemaRoot = DEFAULT_CAMPAIGN_V2_SCHEMA_ROOT,
  projectIds = [],
  contentSubdir = null,
} = {}) {
  const targetProjectIds =
    Array.isArray(projectIds) && projectIds.length > 0
      ? [...new Set(projectIds)]
      : listProjectIds(rootDir).filter((projectId) =>
          detectCampaignV2ContentSubdir(path.join(rootDir, projectId), contentSubdir),
        );

  if (targetProjectIds.length === 0) {
    throw new Error(`No campaign-v2 projects were found in ${rootDir}.`);
  }

  return targetProjectIds.map((projectId) =>
    validateCampaignV2Project({
      rootDir,
      schemaRoot,
      projectId,
      contentSubdir,
    }),
  );
}

export function formatCampaignV2ValidationReport(report) {
  const lines = [];
  lines.push(`Campaign V2 Validation`);
  lines.push(`Project: ${report.project.name} (${report.projectId})`);
  lines.push(`Status: ${report.status.toUpperCase()}`);
  lines.push(`Content root: ${report.contentRoot}`);
  lines.push(`V2 counts: ${formatCountSummary(report.counts.v2)}`);
  lines.push(
    `Legacy counts: places ${report.counts.legacy.places}, locationEntities ${report.counts.legacy.locationEntities}, sessions ${report.counts.legacy.sessions}, hooks ${report.counts.legacy.hooks}, threads ${report.counts.legacy.threads}, patterns ${report.counts.legacy.patterns}, nowMoments ${report.counts.legacy.nowMoments}`,
  );
  lines.push(`Coverage:`);
  for (const item of report.coverage) {
    lines.push(`- ${item.label}: ${item.covered}/${item.total} (${item.percent}%)`);
  }

  const errorIssues = report.issues.filter((issue) => issue.severity === "error");
  const warningIssues = report.issues.filter((issue) => issue.severity === "warning");

  if (errorIssues.length > 0) {
    lines.push(`Errors (${errorIssues.length}):`);
    for (const issue of errorIssues) {
      lines.push(`- [${issue.code}] ${issue.message}`);
    }
  } else {
    lines.push(`Errors: none`);
  }

  if (warningIssues.length > 0) {
    lines.push(`Warnings (${warningIssues.length}):`);
    for (const issue of warningIssues) {
      lines.push(`- [${issue.code}] ${issue.message}`);
    }
  } else {
    lines.push(`Warnings: none`);
  }

  return lines.join("\n");
}

export function formatCampaignV2ValidationSummary(reports) {
  const passed = reports.filter((report) => report.status === "pass").length;
  const failed = reports.length - passed;
  const totalErrors = reports.reduce((sum, report) => sum + report.summary.errorCount, 0);
  const totalWarnings = reports.reduce((sum, report) => sum + report.summary.warningCount, 0);
  const lines = [
    `Validated ${reports.length} campaign-v2 graph${reports.length === 1 ? "" : "s"}: ${passed} passed, ${failed} failed.`,
    `Totals: ${totalErrors} error${totalErrors === 1 ? "" : "s"}, ${totalWarnings} warning${totalWarnings === 1 ? "" : "s"}.`,
  ];

  for (const report of reports) {
    lines.push(
      `- ${report.projectId} (${report.contentSubdir}): ${report.status.toUpperCase()}, ${report.summary.errorCount} error${report.summary.errorCount === 1 ? "" : "s"}, ${report.summary.warningCount} warning${report.summary.warningCount === 1 ? "" : "s"}`,
    );
  }

  return lines.join("\n");
}
