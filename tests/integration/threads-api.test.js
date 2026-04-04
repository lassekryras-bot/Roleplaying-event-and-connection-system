import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withTestServer(handler) {
  const threads = [
    {
      id: "thread-1",
      title: "Whispers in the harbor",
      state: "active",
      gm_truth: "The harbor master is secretly paid by the antagonist.",
      player_summary: "Dockworkers have gone missing at night.",
    },
    {
      id: "thread-2",
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
    const escalateResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "escalated" }),
    });
    const escalatedThread = await escalateResponse.json();

    assert.equal(escalateResponse.status, 200);
    assert.equal(escalatedThread.state, "escalated");

    const resolveResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "escalated" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, "INVALID_STATE_TRANSITION");
    assert.match(payload.error, /dormant -> escalated/);
  });
});
