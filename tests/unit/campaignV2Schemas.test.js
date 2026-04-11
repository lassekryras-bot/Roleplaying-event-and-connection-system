import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const SCHEMAS_ROOT = path.join(process.cwd(), "schemas", "campaign-v2");
const SCHEMA_FILES = [
  "relation.schema.json",
  "location.schema.json",
  "locationState.schema.json",
  "session.schema.json",
  "event.schema.json",
  "effect.schema.json",
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
  const schema = loadJson(path.join(SCHEMAS_ROOT, schemaFile));
  const validate = ajv.getSchema(schema.$id);
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

test("campaign-v2 schemas register all entrypoints", () => {
  const ajv = createAjv();

  for (const schemaFile of SCHEMA_FILES) {
    const schema = loadJson(path.join(SCHEMAS_ROOT, schemaFile));
    assert.ok(ajv.getSchema(schema.$id), `Expected ${schemaFile} to be retrievable by $id.`);
  }
});

test("relation schema accepts a valid relation and rejects an unknown type", () => {
  const ajv = createAjv();
  const validRelation = {
    type: "relatedTo",
    targetId: "location-ash-market",
    status: "active",
  };

  assertSchemaValidity(ajv, "relation.schema.json", validRelation, "Valid relation");

  const invalidRelation = {
    ...validRelation,
    type: "invalid",
  };

  assertSchemaInvalidity(
    ajv,
    "relation.schema.json",
    invalidRelation,
    (error) => error.keyword === "enum" && error.instancePath === "/type",
    "Relation with unsupported type",
  );
});

test("location schema accepts a valid location and rejects leaked play-state fields", () => {
  const ajv = createAjv();
  const validLocation = {
    id: "location-ash-market",
    type: "location",
    title: "Ash Market",
    campaignId: "campaign-1",
    summary: "A soot-covered market district.",
    tags: ["market", "city"],
    relations: [],
  };

  assertSchemaValidity(ajv, "location.schema.json", validLocation, "Valid location");

  const invalidLocation = {
    ...validLocation,
    status: "active",
  };

  assertSchemaInvalidity(
    ajv,
    "location.schema.json",
    invalidLocation,
    (error) => error.keyword === "additionalProperties" && error.params?.additionalProperty === "status",
    "Location with leaked play-state status",
  );
});

test("locationState schema accepts a valid state and rejects a missing summary", () => {
  const ajv = createAjv();
  const validLocationState = {
    id: "location-state-ash-market-fire",
    type: "locationState",
    locationId: "location-ash-market",
    title: "After the Fire",
    summary: "The market is damaged and tense.",
    status: "active",
    notes: "Use after the market fire session.",
    relations: [],
  };

  assertSchemaValidity(ajv, "locationState.schema.json", validLocationState, "Valid locationState");

  const invalidLocationState = structuredClone(validLocationState);
  delete invalidLocationState.summary;

  assertSchemaInvalidity(
    ajv,
    "locationState.schema.json",
    invalidLocationState,
    (error) => error.keyword === "required" && error.params?.missingProperty === "summary",
    "LocationState without summary",
  );
});

test("session schema accepts a valid session and rejects a bad linked location state id", () => {
  const ajv = createAjv();
  const validSession = {
    id: "session-ash-market-01",
    type: "session",
    title: "Opening Night",
    locationId: "location-ash-market",
    summary: "The party arrives as tensions rise.",
    startingLocationStateId: "location-state-ash-market-fire",
    resultingLocationStateId: "location-state-ash-market-rebuilt",
    notes: "Use this as the historical play record for the market fire.",
    relations: [],
  };

  assertSchemaValidity(ajv, "session.schema.json", validSession, "Valid session");

  const invalidSession = {
    ...validSession,
    startingLocationStateId: "location-ash-market",
  };

  assertSchemaInvalidity(
    ajv,
    "session.schema.json",
    invalidSession,
    (error) => error.keyword === "pattern" && error.instancePath === "/startingLocationStateId",
    "Session with invalid startingLocationStateId",
  );
});

test("event schema accepts a valid event and rejects an invalid status", () => {
  const ajv = createAjv();
  const validEvent = {
    id: "event-fire-cleanup",
    type: "event",
    title: "Fire Cleanup",
    summary: "Workers clear debris from the market.",
    status: "available",
    createdEffectIds: ["effect-rubble"],
    relations: [],
  };

  assertSchemaValidity(ajv, "event.schema.json", validEvent, "Valid event");

  const invalidEvent = {
    ...validEvent,
    status: "planning",
  };

  assertSchemaInvalidity(
    ajv,
    "event.schema.json",
    invalidEvent,
    (error) => error.keyword === "enum" && error.instancePath === "/status",
    "Event with invalid status",
  );

  const legacyEvent = {
    ...validEvent,
    description: "Legacy event description field should no longer validate.",
  };

  assertSchemaInvalidity(
    ajv,
    "event.schema.json",
    legacyEvent,
    (error) => error.keyword === "additionalProperties" && error.instancePath === "",
    "Event with legacy description field",
  );
});

test("effect schema accepts a valid effect and rejects an invalid severity", () => {
  const ajv = createAjv();
  const validEffect = {
    id: "effect-rubble",
    type: "effect",
    title: "Rubble Choke Points",
    summary: "Collapsed stalls slow movement through the square.",
    status: "active",
    severity: "medium",
    scope: "city",
    relations: [],
  };

  assertSchemaValidity(ajv, "effect.schema.json", validEffect, "Valid effect");

  const invalidEffect = {
    ...validEffect,
    severity: "extreme",
  };

  assertSchemaInvalidity(
    ajv,
    "effect.schema.json",
    invalidEffect,
    (error) => error.keyword === "enum" && error.instancePath === "/severity",
    "Effect with invalid severity",
  );

  const legacyEffect = {
    ...validEffect,
    description: "Legacy effect description field should no longer validate.",
  };

  assertSchemaInvalidity(
    ajv,
    "effect.schema.json",
    legacyEffect,
    (error) => error.keyword === "additionalProperties" && error.instancePath === "",
    "Effect with legacy description field",
  );

  const invalidScope = {
    ...validEffect,
    scope: "global",
  };

  assertSchemaInvalidity(
    ajv,
    "effect.schema.json",
    invalidScope,
    (error) => error.keyword === "enum" && error.instancePath === "/scope",
    "Effect with legacy global scope",
  );
});
