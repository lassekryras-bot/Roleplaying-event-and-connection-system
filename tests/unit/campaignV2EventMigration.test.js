import test from "node:test";
import assert from "node:assert/strict";

import {
  inferCampaignV2EventType,
  migrateLegacyHookToCampaignV2Event,
  migrateLegacyNowToCampaignV2Event,
  migrateLegacyThreadToCampaignV2Event,
} from "../../src/data/campaignV2EventMigration.js";

test("event type inference recognizes the first-pass gameplay categories", () => {
  assert.equal(
    inferCampaignV2EventType({
      title: "Meet the Broker",
      summary: "The broker finally agrees to talk.",
    }),
    "npc-meeting",
  );
  assert.equal(
    inferCampaignV2EventType({
      title: "Ledger Clue",
      summary: "A hidden ledger proves the payments were real.",
    }),
    "clue-found",
  );
  assert.equal(
    inferCampaignV2EventType({
      title: "Runner Ambush",
      summary: "A chase erupts into a fight under the bridge.",
    }),
    "combat-happened",
  );
  assert.equal(
    inferCampaignV2EventType({
      title: "Harbor Pressure",
      summary: "The heat keeps building across the district.",
    }),
    "consequence-triggered",
  );
  assert.equal(
    inferCampaignV2EventType({
      title: "Harbor Setup",
      summary: "The crew moves to the next scene.",
    }),
    "hook-progressed",
  );
});

test("legacy hook migration builds an event linked to its session and location", () => {
  const event = migrateLegacyHookToCampaignV2Event({
    hook: {
      id: "hook-watch-bribe",
      headline: "Watch Bribe",
      description: "A pay ledger proves the watch was bought off.",
      status: "available",
      checks: [
        {
          id: "check-ledger",
          label: "Decode the ledger",
          attribute: "Investigation",
          dc: 15,
        },
      ],
      notes: "This should point back to the harbor master.",
    },
    eventId: "event-watch-bribe",
    locationId: "location-dockside-yard",
    relatedSessionIds: ["session-harbor-watch-01"],
    relatedThreadTitles: ["Harbor Payments"],
  });

  assert.equal(event.eventType, "clue-found");
  assert.deepEqual(event.createdEffectIds, []);
  assert.ok(event.relations.some((relation) => relation.type === "occursAt" && relation.targetId === "location-dockside-yard"));
  assert.ok(event.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === "session-harbor-watch-01"));
  assert.match(event.notes, /Harbor Payments/);
});

test("legacy thread and now migration produce usable broad events", () => {
  const threadEvent = migrateLegacyThreadToCampaignV2Event({
    thread: {
      id: "thread-runner-ambush",
      title: "Runner Ambush",
      state: "escalated",
      hook: "A courier is cornered and the knives come out.",
      playerSummary: "The chase breaks into open combat.",
      gmTruth: "The courier carries the ledger page the crew needs.",
      timelineAnchor: "future_possible",
      playerVisible: true,
    },
    eventId: "event-runner-ambush",
    relatedLocationIds: ["location-skybridge-market", "location-back-alley"],
    effectId: "effect-market-panic",
  });

  assert.equal(threadEvent.eventType, "combat-happened");
  assert.ok(threadEvent.relations.some((relation) => relation.type === "occursAt" && relation.targetId === "location-skybridge-market"));
  assert.ok(threadEvent.relations.some((relation) => relation.type === "involves" && relation.targetId === "location-back-alley"));
  assert.ok(threadEvent.relations.some((relation) => relation.type === "belongsTo" && relation.targetId === "effect-market-panic"));

  const nowEvent = migrateLegacyNowToCampaignV2Event({
    now: {
      id: "now",
      title: "Current moment",
      playerSummary: "The market is tense and every debt is coming due.",
      gmTruth: "The crackdown has already started.",
    },
    eventId: "event-now-project-1",
    projectName: "Project 1",
    activeSessionId: "session-harbor-watch-01",
    activeLocationId: "location-dockside-yard",
  });

  assert.equal(nowEvent.eventType, "consequence-triggered");
  assert.ok(nowEvent.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === "session-harbor-watch-01"));
  assert.ok(nowEvent.relations.some((relation) => relation.type === "occursAt" && relation.targetId === "location-dockside-yard"));
});
