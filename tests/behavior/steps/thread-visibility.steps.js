import assert from "node:assert/strict";

import { createServer } from "../../../src/api/createServer.js";

export async function beforeScenario(world) {
  world.threads = new Map();
  world.memberships = [];
  world.invites = [];
  world.role = undefined;
  world.userId = undefined;
  world.response = undefined;
  world.payload = undefined;

  world.server = createServer({
    getThreadById: (threadId) => world.threads.get(threadId),
    listThreads: () => [...world.threads.values()].map((thread) => ({ ...thread })),
    listEvents: () => [],
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
  [
    "a thread exists with gm_truth and player_summary",
    async (world) => {
      world.threads.set("thread-1", {
        id: "thread-1",
        title: "Whispers in the harbor",
        gm_truth: "The harbor master is secretly paid by the antagonist.",
        player_summary: "Dockworkers have gone missing at night.",
      });
    },
  ],
  [
    "I am authenticated as a Player in the same project",
    async (world) => {
      world.role = "PLAYER";
      world.userId = "player-1";
    },
  ],
  [
    "I am authenticated as a GM in the same project",
    async (world) => {
      world.role = "GM";
      world.userId = "gm-1";
    },
  ],
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
    "I should receive player_summary",
    async (world) => {
      assert.equal(world.response.status, 200);
      assert.equal(world.payload.player_summary, "Dockworkers have gone missing at night.");
    },
  ],
  [
    "I should not receive gm_truth",
    async (world) => {
      assert.equal(world.payload.gm_truth, undefined);
    },
  ],
  [
    "I should receive gm_truth",
    async (world) => {
      assert.equal(
        world.payload.gm_truth,
        "The harbor master is secretly paid by the antagonist.",
      );
    },
  ],
]);
