import test from "node:test";
import assert from "node:assert/strict";

import { migrateLegacyTimelineSessionToCampaignV2 } from "../../src/data/campaignV2SessionMigration.js";

test("legacy timeline sessions migrate into minimal valid v2 sessions", () => {
  const migratedSession = migrateLegacyTimelineSessionToCampaignV2({
    legacySession: {
      id: "session-harbor-watch-01",
      headline: "Harbor Watch",
      summary: "Pressure the watch captain and keep the docks open.",
      expectedDirection: "Follow the bribe trail into the union yard.",
      notes: "This is the live session focus.",
    },
    locationId: "location-dockside-yard",
    previousSessionId: "session-harbor-watch-00",
    relatedEventIds: ["event-watch-bribe"],
    relatedLocationIds: ["location-dockside-yard", "location-union-yard"],
    startingLocationStateId: "location-state-dockside-yard-initial",
    resultingLocationStateId: "location-state-dockside-yard-post-major-visit",
  });

  assert.deepEqual(migratedSession, {
    id: "session-harbor-watch-01",
    type: "session",
    title: "Harbor Watch",
    locationId: "location-dockside-yard",
    summary: "Pressure the watch captain and keep the docks open.",
    startingLocationStateId: "location-state-dockside-yard-initial",
    resultingLocationStateId: "location-state-dockside-yard-post-major-visit",
    notes: [
      "Follow the bribe trail into the union yard.",
      "This is the live session focus.",
      "Imported from gm-timeline session session-harbor-watch-01.",
    ].join("\n\n"),
    relations: [
      { type: "involves", targetId: "location-union-yard" },
      { type: "relatedTo", targetId: "event-watch-bribe" },
      { type: "follows", targetId: "session-harbor-watch-00" },
    ],
  });
});
