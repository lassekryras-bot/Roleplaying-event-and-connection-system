import test from "node:test";
import assert from "node:assert/strict";

import { MembershipRole } from "../../src/domain/entities.js";
import { filterThreadForRole } from "../../src/visibility/filterThreadForRole.js";
import { sortEventsForTimeline } from "../../src/timeline/sortEvents.js";

test("should hide gm truth from player thread detail", () => {
  const thread = {
    id: "thread-1",
    title: "Whispers in the harbor",
    gm_truth: "The harbor master is secretly paid by the antagonist.",
    player_summary: "Dockworkers have gone missing at night.",
  };

  const result = filterThreadForRole(thread, MembershipRole.PLAYER);

  assert.equal(result.gm_truth, undefined);
  assert.equal(result.player_summary, thread.player_summary);
});

test("should keep gm truth for gm role", () => {
  const thread = {
    id: "thread-2",
    gm_truth: "A cult cell is operating in the old cistern.",
    player_summary: "Strange chanting is heard underground.",
  };

  const result = filterThreadForRole(thread, MembershipRole.GM);

  assert.equal(result.gm_truth, thread.gm_truth);
});

test("should sort events from past to now to future possible", () => {
  const events = [
    { id: "e3", timeline_position: "future_possible", sequence: 1 },
    { id: "e2", timeline_position: "now", sequence: 2 },
    { id: "e1", timeline_position: "past", sequence: 3 },
    { id: "e4", timeline_position: "now", sequence: 1 },
  ];

  const result = sortEventsForTimeline(events);

  assert.deepEqual(
    result.map((event) => event.id),
    ["e1", "e4", "e2", "e3"],
  );
});
