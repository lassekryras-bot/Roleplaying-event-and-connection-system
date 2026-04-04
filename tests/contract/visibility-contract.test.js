import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withContractServer(handler) {
  const threads = [
    {
      id: "thread-1",
      title: "Whispers in the harbor",
      gm_truth: "The harbor master is secretly paid by the antagonist.",
      player_summary: "Dockworkers have gone missing at night.",
    },
  ];

  const events = [
    {
      id: "event-1",
      timeline_position: "past",
      sequence: 10,
      gm_truth: "The saboteur has already met the harbor master.",
      player_summary: "Tensions have been building at the docks.",
    },
  ];

  const server = createServer({
    getThreadById: (threadId) => threads.find((thread) => thread.id === threadId),
    listThreads: () => threads.map((thread) => ({ ...thread })),
    listEvents: () => events.map((event) => ({ ...event })),
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await handler({ baseUrl: `http://127.0.0.1:${port}` });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("contract: GM receives gm_truth on thread detail and timeline", async () => {
  await withContractServer(async ({ baseUrl }) => {
    const [threadResponse, timelineResponse] = await Promise.all([
      fetch(`${baseUrl}/threads/thread-1`, { headers: { "x-role": "GM" } }),
      fetch(`${baseUrl}/timeline/events`, { headers: { "x-role": "GM" } }),
    ]);

    assert.equal(threadResponse.status, 200);
    assert.equal(timelineResponse.status, 200);

    const threadPayload = await threadResponse.json();
    const timelinePayload = await timelineResponse.json();

    assert.equal(threadPayload.gm_truth, "The harbor master is secretly paid by the antagonist.");
    assert.equal(timelinePayload[0].gm_truth, "The saboteur has already met the harbor master.");
  });
});

test("contract: Player never receives gm_truth on thread detail and timeline", async () => {
  await withContractServer(async ({ baseUrl }) => {
    const [threadResponse, timelineResponse] = await Promise.all([
      fetch(`${baseUrl}/threads/thread-1`, { headers: { "x-role": "PLAYER" } }),
      fetch(`${baseUrl}/timeline/events`, { headers: { "x-role": "PLAYER" } }),
    ]);

    assert.equal(threadResponse.status, 200);
    assert.equal(timelineResponse.status, 200);

    const threadPayload = await threadResponse.json();
    const timelinePayload = await timelineResponse.json();

    assert.equal(threadPayload.player_summary, "Dockworkers have gone missing at night.");
    assert.equal(threadPayload.gm_truth, undefined);

    assert.equal(timelinePayload[0].player_summary, "Tensions have been building at the docks.");
    assert.equal(timelinePayload[0].gm_truth, undefined);
  });
});
