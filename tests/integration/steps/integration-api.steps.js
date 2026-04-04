import assert from "node:assert/strict";

import { createServer } from "../../../src/api/createServer.js";
import { steps as threadVisibilitySteps } from "../../behavior/steps/thread-visibility.steps.js";

const FORBIDDEN_ERROR = { error: "forbidden", code: "FORBIDDEN" };

const playerAuthStep = threadVisibilitySteps.get("I am authenticated as a Player in the same project");
const gmAuthStep = threadVisibilitySteps.get("I am authenticated as a GM in the same project");

export async function beforeScenario(world) {
  world.threads = [
    {
      id: "thread-1",
      project_id: "project-1",
      title: "Whispers in the harbor",
      state: "active",
      gm_truth: "The harbor master is secretly paid by the antagonist.",
      player_summary: "Dockworkers have gone missing at night.",
    },
    {
      id: "thread-2",
      project_id: "project-1",
      title: "Ashes in the chapel",
      state: "dormant",
      gm_truth: "A relic was swapped by a cult insider.",
      player_summary: "The chapel is closed after a suspicious fire.",
    },
  ];
  world.events = [
    {
      id: "future-2",
      timeline_position: "future_possible",
      scheduled_for: "2026-08-10T10:00:00.000Z",
      sequence: 1,
      gm_truth: "The coup plan is scheduled for summer.",
      player_summary: "Rumors point to an organized strike in summer.",
    },
    {
      id: "current-2",
      timeline_position: "now",
      occurred_at: "2026-03-05T12:00:00.000Z",
      sequence: 2,
      gm_truth: "A broker met the cult courier this morning.",
      player_summary: "A tense negotiation happened in the market.",
    },
    {
      id: "past-2",
      timeline_position: "past",
      occurred_at: "2026-01-03T08:00:00.000Z",
      sequence: 2,
      gm_truth: "The relic was moved at dawn.",
      player_summary: "The relic disappeared at daybreak.",
    },
    {
      id: "current-1",
      timeline_position: "current",
      occurred_at: "2026-03-05T12:00:00.000Z",
      sequence: 1,
      gm_truth: "A second courier watched from afar.",
      player_summary: "A second observer was seen nearby.",
    },
    {
      id: "past-1",
      timeline_position: "past",
      occurred_at: "2025-12-20T08:00:00.000Z",
      sequence: 1,
      gm_truth: "An informant warned the guild.",
      player_summary: "An early warning spread through the guild.",
    },
    {
      id: "future-1",
      timeline_position: "future_possible",
      scheduled_for: "2026-07-01T10:00:00.000Z",
      sequence: 1,
      gm_truth: "The first attempt is planned for midsummer.",
      player_summary: "The first attempt may happen in midsummer.",
    },
  ];
  world.memberships = [
    { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
    { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
    { project_id: "project-1", user_id: "player-1", role: "PLAYER", status: "active" },
    { project_id: "project-1", user_id: "removed-1", role: "PLAYER", status: "removed" },
  ];
  world.invites = [];
  world.role = undefined;
  world.userId = undefined;
  world.payload = undefined;
  world.response = undefined;

  world.server = createServer({
    getThreadById: (threadId) => world.threads.find((thread) => thread.id === threadId),
    listThreads: () => world.threads.map((thread) => ({ ...thread })),
    listEvents: () => world.events.map((event) => ({ ...event })),
    saveThreadState: (threadId, state) => {
      const thread = world.threads.find((entry) => entry.id === threadId);
      if (!thread) {
        return null;
      }
      thread.state = state;
      return { ...thread };
    },
    createProjectMembership: (projectId, membership) => {
      const created = { project_id: projectId, ...membership, status: "active" };
      world.memberships.push(created);
      return created;
    },
    createProjectInvite: (projectId, invite) => {
      const created = { id: `invite-${world.invites.length + 1}`, project_id: projectId, ...invite };
      world.invites.push(created);
      return created;
    },
    getProjectMembershipByUserId: (projectId, userId) =>
      world.memberships.find((entry) => entry.project_id === projectId && entry.user_id === userId) ?? null,
  });

  await new Promise((resolve) => world.server.listen(0, resolve));
  const address = world.server.address();
  world.baseUrl = `http://127.0.0.1:${address.port}`;
}

export async function afterScenario(world) {
  if (!world.server) {
    return;
  }

  await new Promise((resolve, reject) => {
    world.server.close((error) => (error ? reject(error) : resolve()));
  });
}

export const steps = new Map([
  ["I am authenticated as a Player in the same project", playerAuthStep],
  ["I am authenticated as a GM in the same project", gmAuthStep],
  [
    "I request the thread detail endpoint",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/threads/thread-1`, {
        headers: { "x-role": world.role, "x-user-id": world.userId },
      });
      world.payload = await world.response.json();
    },
  ],
  [
    "I request the timeline events endpoint as a player",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/timeline/events`, { headers: { "x-role": "PLAYER" } });
      world.payload = await world.response.json();
    },
  ],
  [
    "I should receive player_summary without gm_truth",
    async (world) => {
      assert.equal(world.response.status, 200);
      assert.equal(world.payload.player_summary, "Dockworkers have gone missing at night.");
      assert.equal(world.payload.gm_truth, undefined);
    },
  ],
  [
    "I should receive deterministically ordered timeline events",
    async (world) => {
      assert.equal(world.response.status, 200);
      assert.deepEqual(
        world.payload.map((event) => event.id),
        ["past-1", "past-2", "current-1", "current-2", "future-1", "future-2"],
      );
    },
  ],
  [
    "each timeline event should be player safe",
    async (world) => {
      for (const event of world.payload) {
        assert.equal(event.gm_truth, undefined);
        assert.equal(typeof event.player_summary, "string");
      }
    },
  ],
  [
    "I request to escalate and resolve the active thread as GM",
    async (world) => {
      const headers = { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" };
      const escalateResponse = await fetch(`${world.baseUrl}/threads/thread-1`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state: "escalated" }),
      });
      const escalatedPayload = await escalateResponse.json();

      const resolveResponse = await fetch(`${world.baseUrl}/threads/thread-1`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state: "resolved" }),
      });
      const resolvedPayload = await resolveResponse.json();

      world.transitionResult = {
        escalateStatus: escalateResponse.status,
        resolveStatus: resolveResponse.status,
        escalatedState: escalatedPayload.state,
        resolvedState: resolvedPayload.state,
      };
    },
  ],
  [
    "the transition sequence should succeed",
    async (world) => {
      assert.deepEqual(world.transitionResult, {
        escalateStatus: 200,
        resolveStatus: 200,
        escalatedState: "escalated",
        resolvedState: "resolved",
      });
    },
  ],
  [
    "I request a non-canonical state transition",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/threads/thread-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
        body: JSON.stringify({ state: "open" }),
      });
      world.payload = await world.response.json();
    },
  ],
  [
    "I should receive deterministic invalid state error",
    async (world) => {
      assert.equal(world.response.status, 400);
      assert.deepEqual(world.payload, {
        code: "INVALID_STATE_TRANSITION",
        error: "Invalid target thread state: open",
      });
    },
  ],
  [
    "I request an invalid dormant to escalated transition",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/threads/thread-2`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
        body: JSON.stringify({ state: "escalated" }),
      });
      world.payload = await world.response.json();
    },
  ],
  [
    "I should receive invalid transition details",
    async (world) => {
      assert.equal(world.response.status, 400);
      assert.equal(world.payload.code, "INVALID_STATE_TRANSITION");
      assert.match(world.payload.error, /dormant -> escalated/);
    },
  ],
  [
    "I request a thread update as a removed member",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/threads/thread-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-role": "PLAYER", "x-user-id": "removed-1" },
        body: JSON.stringify({ state: "escalated" }),
      });
      world.payload = await world.response.json();
    },
  ],
  [
    "I should receive forbidden response shape",
    async (world) => {
      assert.equal(world.response.status, 403);
      assert.deepEqual(world.payload, FORBIDDEN_ERROR);
    },
  ],
]);
