import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import { createFileCampaignStore } from "../../src/data/fileCampaignStore.js";
import {
  convertCampaignProjectToV2Shadow,
  DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR,
} from "../../src/data/campaignV2ShadowConversion.js";

const SCHEMA_ROOT = path.join(process.cwd(), "schemas", "campaign-v2");
const SCHEMA_FILE_BY_DIRECTORY = {
  locations: "location.schema.json",
  "location-states": "locationState.schema.json",
  sessions: "session.schema.json",
  events: "event.schema.json",
  effects: "effect.schema.json",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createAjv() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  for (const schemaFile of Object.values(SCHEMA_FILE_BY_DIRECTORY)) {
    ajv.addSchema(readJson(path.join(SCHEMA_ROOT, schemaFile)));
  }

  return ajv;
}

function withTempRoot(callback) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "campaign-v2-shadow-"));

  try {
    createFileCampaignStore({ rootDir });
    callback(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function seedMinimalGmTimeline(rootDir, projectId) {
  const contentRoot = path.join(rootDir, projectId, "gm-timeline");

  writeJson(path.join(contentRoot, "timeline.json"), {
    campaignId: projectId,
    title: "Harbor Watch Timeline",
    currentSequence: 2,
    activeSessionId: "session-harbor-watch-01",
    sessionIds: ["session-harbor-watch-01"],
    updatedAt: "2026-04-11T10:00:00.000Z",
  });
  writeJson(path.join(contentRoot, "sessions", "session-harbor-watch-01.json"), {
    id: "session-harbor-watch-01",
    campaignId: projectId,
    sequence: 2,
    status: "active",
    headline: "Harbor Watch",
    summary: "Pressure the watch captain and keep the docks open.",
    expectedDirection: "Follow the bribe trail into the union yard.",
    placeIds: ["place-dockside-yard", "place-union-yard"],
    notes: "This is the live session focus.",
    startedAt: "2026-04-11T18:00:00.000Z",
    updatedAt: "2026-04-11T18:00:00.000Z",
  });
  writeJson(path.join(contentRoot, "places", "place-dockside-yard.json"), {
    id: "place-dockside-yard",
    campaignId: projectId,
    headline: "Dockside Yard",
    description: "A crowded yard where the watch takes quiet payments.",
    tags: ["docks", "pressure"],
    hookIds: ["hook-watch-bribe"],
    notes: "Use the cranes and stacked cargo for cover.",
    updatedAt: "2026-04-11T10:00:00.000Z",
  });
  writeJson(path.join(contentRoot, "places", "place-union-yard.json"), {
    id: "place-union-yard",
    campaignId: projectId,
    headline: "Union Yard",
    description: "The union office and its loading yard.",
    tags: ["union"],
    hookIds: [],
    updatedAt: "2026-04-11T10:00:00.000Z",
  });
  writeJson(path.join(contentRoot, "hooks", "hook-watch-bribe.json"), {
    id: "hook-watch-bribe",
    campaignId: projectId,
    placeId: "place-dockside-yard",
    headline: "Watch Bribe",
    description: "A pay ledger proves the watch was bought off.",
    status: "available",
    priority: "high",
    checks: [
      {
        id: "check-ledger",
        label: "Decode the ledger",
        attribute: "Investigation",
        dc: 15,
        rollMode: "d20_button",
      },
    ],
    threadIds: ["thread-harbor-payments"],
    notes: "This should point back to the harbor master.",
    updatedAt: "2026-04-11T10:00:00.000Z",
  });
  writeJson(path.join(contentRoot, "threads", "thread-harbor-payments.json"), {
    id: "thread-harbor-payments",
    title: "Harbor Payments",
    summary: "Tracks who paid the watch.",
    linkedHookIds: ["hook-watch-bribe"],
    playerVisible: false,
  });
}

function listShadowFiles(rootDir, projectId) {
  const contentRoot = path.join(rootDir, projectId, DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR);
  const files = [];

  for (const [directoryName] of Object.entries(SCHEMA_FILE_BY_DIRECTORY)) {
    const directoryPath = path.join(contentRoot, directoryName);
    if (!fs.existsSync(directoryPath)) {
      continue;
    }

    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(path.join(directoryPath, entry.name));
      }
    }
  }

  return files;
}

test("shadow conversion writes a validated v2 dataset from mixed legacy sources", () => {
  withTempRoot((rootDir) => {
    seedMinimalGmTimeline(rootDir, "project-1");
    const projectFilePath = path.join(rootDir, "project-1", "project.json");
    const projectBefore = readJson(projectFilePath);

    const result = convertCampaignProjectToV2Shadow({
      rootDir,
      projectId: "project-1",
    });

    assert.equal(result.summary.wroteFiles, true);
    assert.ok(result.summary.counts.locations >= 3);
    assert.ok(result.summary.counts.locationStates >= result.summary.counts.locations);
    assert.ok(result.summary.counts.sessions >= 1);
    assert.ok(result.summary.counts.events >= 3);
    assert.ok(result.summary.counts.effects >= 1);
    assert.ok(result.dataset.locations.some((location) => location.title === "Dockside Yard"));
    assert.ok(result.dataset.locations.some((location) => location.title === "Ruined Chapel"));
    assert.ok(result.summary.locationPreview.some((location) => location.title === "Dockside Yard"));
    assert.ok(result.summary.sessionPreview.some((session) => session.title === "Harbor Watch"));
    assert.ok(result.dataset.sessions.some((session) => session.id === "session-harbor-watch-01"));
    assert.ok(result.dataset.events.some((event) => event.eventType === "clue-found"));
    assert.ok(result.dataset.events.some((event) => event.eventType === "consequence-triggered"));
    assert.ok(result.summary.warnings.some((warning) => warning.includes("session-harbor-watch-01")));

    const docksideLocation = result.dataset.locations.find((location) => location.title === "Dockside Yard");
    assert.ok(docksideLocation, "Expected Dockside Yard location in the shadow dataset.");
    assert.deepEqual(Object.keys(docksideLocation).sort(), [
      "campaignId",
      "id",
      "relations",
      "summary",
      "tags",
      "title",
      "type",
    ]);
    const docksideState = result.dataset.locationStates.find(
      (locationState) =>
        locationState.locationId === docksideLocation.id &&
        locationState.title === "Dockside Yard Before Visit",
    );
    assert.ok(docksideState, "Expected Dockside Yard locationState in the shadow dataset.");
    assert.equal(docksideState.title, "Dockside Yard Before Visit");
    assert.equal(docksideState.status, "active");
    assert.deepEqual(Object.keys(docksideState).sort(), [
      "id",
      "locationId",
      "notes",
      "relations",
      "status",
      "summary",
      "title",
      "type",
    ]);
    assert.match(docksideState.notes, /crowded yard/i);
    assert.match(docksideState.notes, /gm-timeline place place-dockside-yard/i);
    assert.ok(docksideState.relations.some((relation) => relation.type === "relatedTo"));

    const docksideAfterState = result.dataset.locationStates.find(
      (locationState) =>
        locationState.locationId === docksideLocation.id &&
        locationState.title !== docksideState.title,
    );
    assert.ok(docksideAfterState, "Expected a post-major-visit Dockside Yard state.");
    assert.match(docksideAfterState.notes, /post-major-visit state/i);

    const harborWatchSession = result.dataset.sessions.find((session) => session.id === "session-harbor-watch-01");
    assert.ok(harborWatchSession, "Expected Harbor Watch session in the shadow dataset.");
    assert.deepEqual(Object.keys(harborWatchSession).sort(), [
      "id",
      "locationId",
      "notes",
      "relations",
      "resultingLocationStateId",
      "startingLocationStateId",
      "summary",
      "title",
      "type",
    ]);
    assert.equal(harborWatchSession.startingLocationStateId, docksideState.id);
    assert.equal(harborWatchSession.resultingLocationStateId, docksideAfterState.id);
    assert.ok(harborWatchSession.relations.some((relation) => relation.type === "relatedTo"));
    assert.equal(harborWatchSession.relations.some((relation) => relation.type === "follows"), false);

    const watchBribeEvent = result.dataset.events.find((event) => event.title === "Watch Bribe");
    assert.ok(watchBribeEvent, "Expected Watch Bribe event in the shadow dataset.");
    assert.deepEqual(Object.keys(watchBribeEvent).sort(), [
      "createdEffectIds",
      "eventType",
      "id",
      "notes",
      "relations",
      "status",
      "summary",
      "title",
      "type",
    ]);
    assert.ok(watchBribeEvent.relations.some((relation) => relation.type === "occursAt" && relation.targetId === docksideLocation.id));
    assert.ok(
      watchBribeEvent.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === harborWatchSession.id),
    );

    const nowEvent = result.dataset.events.find((event) => event.id === "event-now-project-1");
    assert.ok(nowEvent, "Expected a now event in the shadow dataset.");
    assert.ok(nowEvent.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === harborWatchSession.id));
    assert.ok(nowEvent.relations.some((relation) => relation.type === "occursAt" && relation.targetId === docksideLocation.id));

    const unionYardLocation = result.dataset.locations.find((location) => location.title === "Dockworkers Union Yard");
    assert.ok(unionYardLocation, "Expected Dockworkers Union Yard in the shadow dataset.");
    const unionYardState = result.dataset.locationStates.find(
      (locationState) => locationState.locationId === unionYardLocation.id,
    );
    assert.ok(unionYardState, "Expected Dockworkers Union Yard locationState in the shadow dataset.");
    assert.equal(
      unionYardState.relations.some((relation) => relation.type === "appliesTo" && relation.targetId.startsWith("effect-")),
      false,
      "Location state effect relevance should be resolved from effect scope, not copied into locationState relations.",
    );

    const wantedInCity = result.dataset.effects.find((effect) => effect.title === "Wanted in City");
    const heightenedSecurity = result.dataset.effects.find((effect) => effect.title === "Heightened Security");
    const barIgnoresWantedStatus = result.dataset.effects.find((effect) => effect.title === "Bar Ignores Wanted Status");
    assert.ok(wantedInCity, "Expected Wanted in City effect in the shadow dataset.");
    assert.equal(wantedInCity.scope, "city");
    assert.ok(wantedInCity.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === nowEvent.id));
    assert.ok(heightenedSecurity, "Expected Heightened Security effect in the shadow dataset.");
    assert.equal(heightenedSecurity.scope, "local");
    assert.ok(
      heightenedSecurity.relations.some(
        (relation) => relation.type === "appliesTo" && relation.targetId === unionYardLocation.id,
      ),
    );
    assert.ok(barIgnoresWantedStatus, "Expected Bar Ignores Wanted Status effect in the shadow dataset.");
    assert.ok(
      barIgnoresWantedStatus.relations.some(
        (relation) => relation.type === "appliesTo" && relation.targetId === unionYardLocation.id,
      ),
    );
    assert.ok(
      barIgnoresWantedStatus.relations.some(
        (relation) => relation.type === "modifies" && relation.targetId === wantedInCity.id,
      ),
    );

    const ajv = createAjv();
    const shadowFiles = listShadowFiles(rootDir, "project-1");
    assert.ok(shadowFiles.length > 0, "Expected shadow files to be written.");

    for (const filePath of shadowFiles) {
      const directoryName = path.basename(path.dirname(filePath));
      const schemaFile = SCHEMA_FILE_BY_DIRECTORY[directoryName];
      const schema = readJson(path.join(SCHEMA_ROOT, schemaFile));
      const validate = ajv.getSchema(schema.$id);
      assert.ok(validate, `Expected validator for ${schemaFile}.`);
      const isValid = validate(readJson(filePath));
      assert.equal(
        isValid,
        true,
        `${path.relative(rootDir, filePath)} failed ${schemaFile}: ${ajv.errorsText(validate.errors, { separator: "\n" })}`,
      );
    }

    const projectAfter = readJson(projectFilePath);
    assert.deepEqual(projectAfter, projectBefore);
  });
});

test("shadow conversion dry-run validates source campaigns without writing files", () => {
  withTempRoot((rootDir) => {
    const result = convertCampaignProjectToV2Shadow({
      rootDir,
      projectId: "project-2",
      dryRun: true,
    });

    assert.equal(result.summary.wroteFiles, false);
    assert.equal(result.dataset.sessions.length, 0);
    assert.ok(result.dataset.locations.length > 0);
    assert.ok(result.dataset.events.length > 0);
    assert.ok(result.dataset.effects.length > 0);
    assert.equal(
      fs.existsSync(path.join(rootDir, "project-2", DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR)),
      false,
    );
  });
});

test("shadow conversion migrates at least five gameplay events from real campaign data", () => {
  const result = convertCampaignProjectToV2Shadow({
    rootDir: path.join(process.cwd(), "campaigns"),
    projectId: "project-3",
    dryRun: true,
  });

  assert.equal(result.summary.wroteFiles, false);
  assert.ok(result.dataset.events.length >= 5);
  assert.ok(
    result.dataset.events.some((event) =>
      ["npc-meeting", "clue-found", "combat-happened", "hook-progressed", "consequence-triggered"].includes(
        event.eventType,
      ),
    ),
  );
  assert.ok(
    result.dataset.events.some((event) =>
      event.relations.some((relation) => relation.type === "occursAt" && relation.targetId.startsWith("location-")),
    ),
  );
  assert.ok(
    result.dataset.events.some((event) =>
      event.relations.some((relation) => relation.type === "relatedTo" && relation.targetId.startsWith("session-")),
    ),
  );
});
