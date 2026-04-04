import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withTestServer(handler) {
  const threads = [
    {
      id: "thread-1",
      title: "Whispers in the harbor",
      gm_truth: "The harbor master is secretly paid by the antagonist.",
      player_summary: "Dockworkers have gone missing at night.",
    },
  ];
  const events = [
    { id: "e3", timeline_position: "future_possible", sequence: 1 },
    { id: "e2", timeline_position: "now", sequence: 2 },
    { id: "e1", timeline_position: "past", sequence: 3 },
  ];

  const server = createServer({
    getThreadById: (threadId) => threads.find((thread) => thread.id === threadId),
    listThreads: () => threads.map((thread) => ({ ...thread })),
    listEvents: () => events.map((event) => ({ ...event })),
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

test("should return gm_truth for GM role on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": "GM" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.gm_truth, "The harbor master is secretly paid by the antagonist.");
  });
});

test("should return role-consistent thread payloads between list and detail endpoints", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const [listResponse, detailResponse] = await Promise.all([
      fetch(`${baseUrl}/threads`, {
        headers: { "x-role": "PLAYER" },
      }),
      fetch(`${baseUrl}/threads/thread-1`, {
        headers: { "x-role": "PLAYER" },
      }),
    ]);

    const listPayload = await listResponse.json();
    const detailPayload = await detailResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(detailResponse.status, 200);
    assert.equal(listPayload[0].id, detailPayload.id);
    assert.equal(listPayload[0].player_summary, detailPayload.player_summary);
    assert.equal(listPayload[0].gm_truth, undefined);
    assert.equal(detailPayload.gm_truth, undefined);
  });
});

test("should reject unsupported role on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": "OBSERVER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /Unsupported role/);
    assert.equal(payload.code, "UNSUPPORTED_ROLE");
  });
});

test("should return 401 when role header is missing on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "role header is required");
  });
});

test("should normalize lowercase role value on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": " player " },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.gm_truth, undefined);
  });
});

test("should return stable unsupported-role code for malformed role value", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": " gm!!! " },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, "UNSUPPORTED_ROLE");
  });
});

test("should return filtered thread list on GET /threads for PLAYER role", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads`, {
      headers: { "x-role": "PLAYER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(payload), true);
    assert.equal(payload[0].gm_truth, undefined);
  });
});

test("should return health endpoint status on GET /health", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
  });
});

test("should return sorted timeline events on GET /timeline/events", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/timeline/events`, {
      headers: { "x-role": "PLAYER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      payload.map((event) => event.id),
      ["e1", "e2", "e3"],
    );
  });
});
