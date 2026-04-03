import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withTestServer(handler) {
  const threads = new Map([
    [
      "thread-1",
      {
        id: "thread-1",
        title: "Whispers in the harbor",
        gm_truth: "The harbor master is secretly paid by the antagonist.",
        player_summary: "Dockworkers have gone missing at night.",
      },
    ],
  ]);

  const server = createServer({
    getThreadById: (threadId) => threads.get(threadId),
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

test("should reject unsupported role on GET /threads/:id", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": "OBSERVER" },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /Unsupported role/);
  });
});
