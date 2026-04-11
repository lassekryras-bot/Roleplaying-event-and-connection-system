import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const CAMPAIGNS_ROOT = path.join(process.cwd(), "campaigns");
const SCHEMAS_ROOT = path.join(process.cwd(), "schemas", "campaign");
const SCHEMA_BASE_ID = "https://living-campaign.dev/schemas/campaign/";
const SCHEMA_FILES = [
  "common.schema.json",
  "project.schema.json",
  "now.schema.json",
  "thread.schema.json",
  "pattern.schema.json",
  "entity.schema.json",
  "player-profiles.schema.json",
  "manual-links.schema.json",
  "sharing.schema.json",
  "history-index.schema.json",
  "snapshot.schema.json",
  "revision.schema.json",
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function schemaId(fileName) {
  return `${SCHEMA_BASE_ID}${fileName}`;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function createAjv() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  for (const schemaFile of SCHEMA_FILES) {
    ajv.addSchema(loadJson(path.join(SCHEMAS_ROOT, schemaFile)));
  }

  return ajv;
}

function getValidator(ajv, schemaFile) {
  const validate = ajv.getSchema(schemaId(schemaFile));
  assert.ok(validate, `Expected ${schemaFile} to be registered.`);
  return validate;
}

function assertSchemaValidity(ajv, schemaFile, payload, context) {
  const validate = getValidator(ajv, schemaFile);
  const isValid = validate(payload);

  assert.equal(
    isValid,
    true,
    `${context} failed ${schemaFile} validation.\n${ajv.errorsText(validate.errors, { separator: "\n" })}`,
  );
}

function assertSchemaInvalidity(ajv, schemaFile, payload, matcher, context) {
  const validate = getValidator(ajv, schemaFile);
  const isValid = validate(payload);

  assert.equal(isValid, false, `${context} unexpectedly passed ${schemaFile}.`);
  assert.ok(validate.errors?.some(matcher), `${context} failed for an unexpected reason.`);
}

function listJsonFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return listJsonFiles(entryPath);
      }

      return entry.name.endsWith(".json") ? [entryPath] : [];
    });
}

function collectCampaignValidationTargets() {
  const targets = [];
  const projectEntries = fs
    .readdirSync(CAMPAIGNS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(CAMPAIGNS_ROOT, entry.name));

  for (const projectDir of projectEntries) {
    targets.push({ filePath: path.join(projectDir, "project.json"), schemaFile: "project.schema.json" });
    targets.push({ filePath: path.join(projectDir, "now.json"), schemaFile: "now.schema.json" });
    targets.push({
      filePath: path.join(projectDir, "player-profiles.json"),
      schemaFile: "player-profiles.schema.json",
    });
    targets.push({ filePath: path.join(projectDir, "sharing.json"), schemaFile: "sharing.schema.json" });
    targets.push({
      filePath: path.join(projectDir, "links", "manual-links.json"),
      schemaFile: "manual-links.schema.json",
    });
    targets.push({
      filePath: path.join(projectDir, "history", "index.json"),
      schemaFile: "history-index.schema.json",
    });

    for (const filePath of listJsonFiles(path.join(projectDir, "threads"))) {
      targets.push({ filePath, schemaFile: "thread.schema.json" });
    }

    for (const filePath of listJsonFiles(path.join(projectDir, "patterns"))) {
      targets.push({ filePath, schemaFile: "pattern.schema.json" });
    }

    for (const filePath of listJsonFiles(path.join(projectDir, "entities"))) {
      targets.push({ filePath, schemaFile: "entity.schema.json" });
    }

    for (const filePath of listJsonFiles(path.join(projectDir, "history", "revisions"))) {
      targets.push({ filePath, schemaFile: "revision.schema.json" });
    }
  }

  return targets;
}

test("campaign schemas validate every persisted campaign file", () => {
  const ajv = createAjv();
  const targets = collectCampaignValidationTargets();
  const matchedPaths = new Set(targets.map((target) => normalizePath(path.resolve(target.filePath))));
  const allCampaignJson = listJsonFiles(CAMPAIGNS_ROOT).map((filePath) => normalizePath(path.resolve(filePath)));
  const unmatchedFiles = allCampaignJson.filter((filePath) => !matchedPaths.has(filePath));

  assert.deepEqual(unmatchedFiles, [], "Expected every campaign JSON file to be covered by a schema target.");

  for (const target of targets) {
    assertSchemaValidity(
      ajv,
      target.schemaFile,
      loadJson(target.filePath),
      normalizePath(path.relative(process.cwd(), target.filePath)),
    );
  }
});

test("thread schema rejects missing required fields", () => {
  const ajv = createAjv();
  const thread = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "threads", "thread-test-95.json"));
  delete thread.state;

  assertSchemaInvalidity(
    ajv,
    "thread.schema.json",
    thread,
    (error) => error.keyword === "required" && error.params?.missingProperty === "state",
    "Thread without state",
  );
});

test("thread schema rejects bad enum values", () => {
  const ajv = createAjv();
  const thread = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "threads", "thread-test-95.json"));
  thread.state = "pending";

  assertSchemaInvalidity(
    ajv,
    "thread.schema.json",
    thread,
    (error) => error.keyword === "enum" && error.instancePath === "/state",
    "Thread with unsupported state",
  );
});

test("staging objects must match the shared staging shape", () => {
  const ajv = createAjv();
  const thread = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "threads", "thread-test-95.json"));
  thread.staging = {
    isStaged: true,
    trayAnchor: "later",
  };

  assertSchemaInvalidity(
    ajv,
    "thread.schema.json",
    thread,
    (error) => error.keyword === "enum" && error.instancePath === "/staging/trayAnchor",
    "Thread with malformed staging",
  );

  const pattern = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "patterns", "pattern-test-3.json"));
  pattern.staging = {
    trayAnchor: "now",
  };

  assertSchemaInvalidity(
    ajv,
    "pattern.schema.json",
    pattern,
    (error) => error.keyword === "required" && error.params?.missingProperty === "isStaged",
    "Pattern with incomplete staging",
  );
});

test("collection schemas reject wrong collection shapes", () => {
  const ajv = createAjv();
  const playerProfiles = {
    bad: true,
  };
  const manualLinks = {
    links: [],
  };
  const sharing = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "sharing.json"));
  sharing.playerNodeIdsByPlayer = [];
  const historyIndex = loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "history", "index.json"));
  historyIndex.revisionIds = {};

  assertSchemaInvalidity(
    ajv,
    "player-profiles.schema.json",
    playerProfiles,
    (error) => error.keyword === "type" && error.instancePath === "",
    "Player profiles with object root",
  );
  assertSchemaInvalidity(
    ajv,
    "manual-links.schema.json",
    manualLinks,
    (error) => error.keyword === "type" && error.instancePath === "",
    "Manual links with object root",
  );
  assertSchemaInvalidity(
    ajv,
    "sharing.schema.json",
    sharing,
    (error) => error.keyword === "type" && error.instancePath === "/playerNodeIdsByPlayer",
    "Sharing with array player map",
  );
  assertSchemaInvalidity(
    ajv,
    "history-index.schema.json",
    historyIndex,
    (error) => error.keyword === "type" && error.instancePath === "/revisionIds",
    "History index with object revision IDs",
  );
});

test("revision schema rejects invalid nested snapshot data", () => {
  const ajv = createAjv();
  const revision = cloneValue(
    loadJson(path.join(CAMPAIGNS_ROOT, "project-3", "history", "revisions", "revision-0001.json")),
  );
  delete revision.snapshot.threads[0].state;

  assertSchemaInvalidity(
    ajv,
    "revision.schema.json",
    revision,
    (error) =>
      error.keyword === "required" &&
      error.instancePath === "/snapshot/threads/0" &&
      error.params?.missingProperty === "state",
    "Revision with invalid nested snapshot thread",
  );
});
