import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  formatCampaignV2ValidationReport,
  formatCampaignV2ValidationSummary,
  validateCampaignV2Project,
} from "../../src/data/campaignV2MigrationReport.js";

const tempDirectories = [];

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createWorkspace() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "campaign-v2-report-"));
  tempDirectories.push(rootDir);
  return rootDir;
}

function seedProjectSkeleton(rootDir, projectId) {
  const projectRoot = path.join(rootDir, projectId);
  writeJson(path.join(projectRoot, "project.json"), {
    id: projectId,
    name: "Audit Fixture",
    status: "active",
  });
  writeJson(path.join(projectRoot, "now.json"), {
    id: "now-fixture",
    title: "Current pressure",
    playerSummary: "The harbor is on edge.",
    gmTruth: "A courier is about to run.",
  });
}

function seedValidCoverageFixture(rootDir, projectId) {
  const projectRoot = path.join(rootDir, projectId);
  seedProjectSkeleton(rootDir, projectId);

  writeJson(path.join(projectRoot, "threads", "thread-smoke.json"), {
    id: "thread-smoke",
    title: "Smoke Thread",
    playerSummary: "The smugglers are stirring.",
    gmTruth: "The runner carries blackmail ledgers.",
  });
  writeJson(path.join(projectRoot, "patterns", "pattern-pressure.json"), {
    id: "pattern-pressure",
    title: "Pressure Pattern",
    summary: "The harbor pressure is building.",
  });
  writeJson(path.join(projectRoot, "gm-timeline", "places", "place-harbor.json"), {
    id: "place-harbor",
    campaignId: projectId,
    headline: "Harbor",
    description: "A loud harbor under watch.",
    hookIds: ["hook-ghost-barge"],
    updatedAt: "2026-04-12T08:00:00Z",
  });
  writeJson(path.join(projectRoot, "gm-timeline", "sessions", "session-smoke-on-the-quay.json"), {
    id: "session-smoke-on-the-quay",
    campaignId: projectId,
    sequence: 1,
    status: "active",
    headline: "Smoke on the Quay",
    summary: "The crew meets their harbor contact.",
    placeIds: ["place-harbor"],
    startedAt: "2026-04-12T18:00:00Z",
    updatedAt: "2026-04-12T18:00:00Z",
  });
  writeJson(path.join(projectRoot, "gm-timeline", "hooks", "hook-ghost-barge.json"), {
    id: "hook-ghost-barge",
    campaignId: projectId,
    placeId: "place-harbor",
    headline: "Ghost Barge",
    description: "The barges move without manifests.",
    status: "available",
    checks: [],
    threadIds: [],
    updatedAt: "2026-04-12T18:00:00Z",
  });

  writeJson(path.join(projectRoot, "campaign-v2-shadow", "locations", "location-harbor.json"), {
    id: "location-harbor",
    type: "location",
    campaignId: projectId,
    title: "Harbor",
    summary: "A loud harbor under watch.",
    tags: ["harbor"],
    relations: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "location-states", "location-state-harbor-initial.json"), {
    id: "location-state-harbor-initial",
    type: "locationState",
    locationId: "location-harbor",
    title: "Harbor Before Visit",
    summary: "The harbor is tense but open.",
    status: "active",
    notes: "Initial state.",
    relations: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "sessions", "session-smoke-on-the-quay.json"), {
    id: "session-smoke-on-the-quay",
    type: "session",
    title: "Smoke on the Quay",
    locationId: "location-harbor",
    summary: "The crew meets their harbor contact.",
    notes: "Imported session.",
    relations: [],
    startingLocationStateId: "location-state-harbor-initial",
    resultingLocationStateId: "location-state-harbor-initial",
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "events", "event-hook-ghost-barge.json"), {
    id: "event-hook-ghost-barge",
    type: "event",
    title: "Ghost Barge",
    summary: "The barges move without manifests.",
    status: "available",
    notes: null,
    relations: [
      { type: "occursAt", targetId: "location-harbor" },
      { type: "relatedTo", targetId: "session-smoke-on-the-quay" },
    ],
    eventType: "clue-found",
    createdEffectIds: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "events", "event-thread-smoke.json"), {
    id: "event-thread-smoke",
    type: "event",
    title: "Smoke Thread",
    summary: "The smugglers are stirring.",
    status: "active",
    notes: null,
    relations: [
      { type: "occursAt", targetId: "location-harbor" },
      { type: "relatedTo", targetId: "session-smoke-on-the-quay" },
      { type: "belongsTo", targetId: "effect-pattern-pressure" },
    ],
    eventType: "hook-progressed",
    createdEffectIds: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "events", "event-now-audit-fixture.json"), {
    id: "event-now-audit-fixture",
    type: "event",
    title: "Current pressure",
    summary: "The harbor is on edge.",
    status: "active",
    notes: null,
    relations: [
      { type: "occursAt", targetId: "location-harbor" },
      { type: "relatedTo", targetId: "session-smoke-on-the-quay" },
    ],
    eventType: "consequence-triggered",
    createdEffectIds: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2-shadow", "effects", "effect-pattern-pressure.json"), {
    id: "effect-pattern-pressure",
    type: "effect",
    title: "Pressure Pattern",
    summary: "The harbor pressure is building.",
    status: "active",
    notes: null,
    relations: [{ type: "appliesTo", targetId: "location-harbor" }],
    effectType: "pressure",
    scope: "local",
    severity: "medium",
  });
}

function seedBrokenGraphFixture(rootDir, projectId) {
  const projectRoot = path.join(rootDir, projectId);
  seedProjectSkeleton(rootDir, projectId);

  writeJson(path.join(projectRoot, "campaign-v2", "locations", "location-harbor.json"), {
    id: "location-harbor",
    type: "location",
    campaignId: projectId,
    title: "Harbor",
    summary: "A loud harbor under watch.",
    tags: ["harbor"],
    relations: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2", "sessions", "session-orphan.json"), {
    id: "session-orphan",
    type: "session",
    title: "Orphan Session",
    locationId: "location-harbor",
    summary: "No graph links beyond the bare minimum.",
    notes: null,
    relations: [],
    startingLocationStateId: null,
    resultingLocationStateId: null,
  });
  writeJson(path.join(projectRoot, "campaign-v2", "events", "event-broken.json"), {
    id: "event-broken",
    type: "event",
    title: "Broken Event",
    summary: "Points at a missing session.",
    status: "active",
    notes: null,
    relations: [{ type: "relatedTo", targetId: "session-missing" }],
    eventType: "hook-progressed",
    createdEffectIds: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2", "events", "event-orphan.json"), {
    id: "event-orphan",
    type: "event",
    title: "Orphan Event",
    summary: "Never attached to anything.",
    status: "available",
    notes: null,
    relations: [],
    eventType: "hook-progressed",
    createdEffectIds: [],
  });
  writeJson(path.join(projectRoot, "campaign-v2", "effects", "effect-orphan.json"), {
    id: "effect-orphan",
    type: "effect",
    title: "Orphan Effect",
    summary: "Never scoped into the graph.",
    status: "active",
    notes: null,
    relations: [],
    effectType: "pressure",
    scope: "local",
    severity: "low",
  });
}

test.after(() => {
  for (const directory of tempDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("validateCampaignV2Project builds a readable passing report with migration coverage", () => {
  const rootDir = createWorkspace();
  seedValidCoverageFixture(rootDir, "audit-fixture");

  const report = validateCampaignV2Project({
    rootDir,
    projectId: "audit-fixture",
  });

  assert.equal(report.status, "pass");
  assert.equal(report.contentSubdir, "campaign-v2-shadow");
  assert.equal(report.summary.errorCount, 0);
  assert.equal(report.summary.warningCount, 0);
  assert.equal(report.counts.v2.locations, 1);
  assert.equal(report.counts.v2.locationStates, 1);
  assert.equal(report.counts.v2.sessions, 1);
  assert.equal(report.counts.v2.events, 3);
  assert.equal(report.counts.v2.effects, 1);
  assert.deepEqual(
    report.coverage.map((item) => [item.label, item.covered, item.total]),
    [
      ["gm-timeline places -> v2 locations", 1, 1],
      ["legacy location entities -> v2 locations", 0, 0],
      ["gm-timeline sessions -> v2 sessions", 1, 1],
      ["gm-timeline hooks -> v2 events", 1, 1],
      ["legacy threads -> v2 events", 1, 1],
      ["legacy patterns -> v2 effects", 1, 1],
      ["legacy now moments -> v2 events", 1, 1],
      ["v2 locations with at least one locationState", 1, 1],
    ],
  );

  const formatted = formatCampaignV2ValidationReport(report);
  assert.match(formatted, /Status: PASS/);
  assert.match(formatted, /Coverage:/);
  assert.match(formatted, /Warnings: none/);

  const summary = formatCampaignV2ValidationSummary([report]);
  assert.match(summary, /1 passed, 0 failed/);
});

test("validateCampaignV2Project surfaces missing targets and orphaned graph objects clearly", () => {
  const rootDir = createWorkspace();
  seedBrokenGraphFixture(rootDir, "audit-broken");

  const report = validateCampaignV2Project({
    rootDir,
    projectId: "audit-broken",
  });

  assert.equal(report.status, "fail");
  assert.equal(report.summary.errorCount, 1);
  assert.equal(report.summary.warningCount, 3);
  assert.ok(report.issues.some((issue) => issue.code === "MISSING_TARGET_ID" && issue.targetId === "session-missing"));
  assert.ok(report.issues.some((issue) => issue.code === "ORPHAN_SESSION" && issue.objectId === "session-orphan"));
  assert.ok(report.issues.some((issue) => issue.code === "ORPHAN_EVENT" && issue.objectId === "event-orphan"));
  assert.ok(report.issues.some((issue) => issue.code === "ORPHAN_EFFECT" && issue.objectId === "effect-orphan"));

  const formatted = formatCampaignV2ValidationReport(report);
  assert.match(formatted, /\[MISSING_TARGET_ID\]/);
  assert.match(formatted, /\[ORPHAN_SESSION\]/);
  assert.match(formatted, /\[ORPHAN_EVENT\]/);
  assert.match(formatted, /\[ORPHAN_EFFECT\]/);
});
