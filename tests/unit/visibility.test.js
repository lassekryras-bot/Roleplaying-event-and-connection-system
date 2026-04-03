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
  assert.equal(thread.gm_truth, "The harbor master is secretly paid by the antagonist.");
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

test("should keep gm truth for helper gm role", () => {
  const thread = {
    id: "thread-3",
    gm_truth: "The watch captain is covering for smugglers.",
    player_summary: "The city guard has been unusually absent at night.",
  };

  const result = filterThreadForRole(thread, MembershipRole.HELPER_GM);

  assert.equal(result.gm_truth, thread.gm_truth);
});

test("should throw error for unsupported visibility role", () => {
  assert.throws(
    () => filterThreadForRole({ id: "thread-4", gm_truth: "secret" }, "OBSERVER"),
    /Unsupported role: OBSERVER/,
  );
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

test("should sort unknown timeline positions after known positions", () => {
  const events = [
    { id: "e1", timeline_position: "unknown", sequence: 0 },
    { id: "e2", timeline_position: "past", sequence: 1 },
    { id: "e3", timeline_position: "now", sequence: 1 },
  ];

  const result = sortEventsForTimeline(events);

  assert.deepEqual(
    result.map((event) => event.id),
    ["e2", "e3", "e1"],
  );
});

test("should throw error when timeline sorter input is not an array", () => {
  assert.throws(
    () => sortEventsForTimeline({}),
    /events must be an array/,
  );
});
