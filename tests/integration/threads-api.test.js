import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

const FORBIDDEN_ERROR = { error: "forbidden", code: "FORBIDDEN" };

async function withTestServer(handler) {
  const threads = [
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
  const events = [
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
  const memberships = [
    { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
    { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
    { project_id: "project-1", user_id: "player-1", role: "PLAYER", status: "active" },
    { project_id: "project-1", user_id: "removed-1", role: "PLAYER", status: "removed" },
  ];
  const invites = [];

  const server = createServer({
    getThreadById: (threadId) => threads.find((thread) => thread.id === threadId),
    listThreads: () => threads.map((thread) => ({ ...thread })),
    listEvents: () => events.map((event) => ({ ...event })),
    saveThreadState: (threadId, state) => {
      const thread = threads.find((entry) => entry.id === threadId);
      if (!thread) {
        return null;
      }

      thread.state = state;
      return { ...thread };
    },
    createProjectMembership: (projectId, membership) => {
      const created = { project_id: projectId, ...membership, status: "active" };
      memberships.push(created);
      return created;
    },
    createProjectInvite: (projectId, invite) => {
      const created = { id: `invite-${invites.length + 1}`, project_id: projectId, ...invite };
      invites.push(created);
      return created;
    },
    getProjectMembershipByUserId: (projectId, userId) =>
      memberships.find((entry) => entry.project_id === projectId && entry.user_id === userId) ?? null,
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler({ baseUrl });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("should return player-safe payload for PLAYER role on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": "PLAYER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.id, "thread-1");
    assert.equal(payload.player_summary, "Dockworkers have gone missing at night.");
    assert.equal(payload.gm_truth, undefined);
  });
});

test("should return deterministic timeline ordering across mixed timestamps", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/timeline/events`, {
      headers: { "x-role": "PLAYER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      payload.map((event) => event.id),
      ["past-1", "past-2", "current-1", "current-2", "future-1", "future-2"],
    );
  });
});

test("should return role-safe timeline payload output for PLAYER role", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/timeline/events`, {
      headers: { "x-role": "PLAYER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    for (const event of payload) {
      assert.equal(event.gm_truth, undefined);
      assert.equal(typeof event.player_summary, "string");
    }
  });
});

test("should allow valid escalation transitions", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const headers = { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" };

    const escalateResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "escalated" }),
    });
    const escalatedThread = await escalateResponse.json();

    assert.equal(escalateResponse.status, 200);
    assert.equal(escalatedThread.state, "escalated");

    const resolveResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "resolved" }),
    });
    const resolvedThread = await resolveResponse.json();

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolvedThread.state, "resolved");
  });
});

test("should reject invalid escalation transitions", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-2`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
      body: JSON.stringify({ state: "escalated" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, "INVALID_STATE_TRANSITION");
    assert.match(payload.error, /dormant -> escalated/);
  });
});

test("should expose all write endpoints for projects, memberships, invites, and thread updates", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/meta/write-endpoints`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.write_endpoints, [
      { method: "PATCH", path: "/threads/:threadId", domain: "thread updates" },
      { method: "POST", path: "/projects/:projectId/memberships", domain: "memberships" },
      { method: "POST", path: "/projects/:projectId/invites", domain: "invites" },
    ]);
  });
});

test("should forbid removed member thread updates with consistent forbidden shape", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-role": "PLAYER", "x-user-id": "removed-1" },
      body: JSON.stringify({ state: "escalated" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, FORBIDDEN_ERROR);
  });
});

test("should enforce helper role restrictions for invite and membership writes", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const headers = { "content-type": "application/json", "x-role": "HELPER", "x-user-id": "helper-1" };

    const inviteResponse = await fetch(`${baseUrl}/projects/project-1/invites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "new@helper.test", role: "PLAYER" }),
    });
    const invitePayload = await inviteResponse.json();

    const membershipResponse = await fetch(`${baseUrl}/projects/project-1/memberships`, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: "player-2", role: "PLAYER" }),
    });
    const membershipPayload = await membershipResponse.json();

    assert.equal(inviteResponse.status, 403);
    assert.deepEqual(invitePayload, FORBIDDEN_ERROR);
    assert.equal(membershipResponse.status, 403);
    assert.deepEqual(membershipPayload, FORBIDDEN_ERROR);
  });
});

test("should reject role mismatch on invite and thread write actions", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const inviteResponse = await fetch(`${baseUrl}/projects/project-1/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "player-1" },
      body: JSON.stringify({ email: "new@campaign.test", role: "PLAYER" }),
    });
    const invitePayload = await inviteResponse.json();

    const threadResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-role": "HELPER", "x-user-id": "player-1" },
      body: JSON.stringify({ state: "escalated" }),
    });
    const threadPayload = await threadResponse.json();

    assert.equal(inviteResponse.status, 403);
    assert.deepEqual(invitePayload, FORBIDDEN_ERROR);
    assert.equal(threadResponse.status, 403);
    assert.deepEqual(threadPayload, FORBIDDEN_ERROR);
  });
});
