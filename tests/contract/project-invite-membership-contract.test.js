import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withContractServer(handler) {
  const projects = [{ id: "project-1", name: "Harbor of Whispers", status: "active" }];
  const memberships = [
    { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
    { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
    { project_id: "project-1", user_id: "player-1", role: "PLAYER", status: "active" },
  ];
  const invites = [];

  const server = createServer({
    getThreadById: () => null,
    listThreads: () => [],
    listEvents: () => [],
    listProjects: () => projects.map((project) => ({ ...project })),
    listMemberships: ({ projectId, userId } = {}) =>
      memberships
        .filter((entry) => {
          if (projectId && entry.project_id !== projectId) {
            return false;
          }
          if (userId && entry.user_id !== userId) {
            return false;
          }
          return true;
        })
        .map((entry) => ({ ...entry })),
    createProjectInvite: (projectId, invite) => {
      const created = { id: `invite-${invites.length + 1}`, project_id: projectId, ...invite };
      invites.push(created);
      return created;
    },
    getProjectMembershipByUserId: (projectId, userId) =>
      memberships.find((entry) => entry.project_id === projectId && entry.user_id === userId) ?? null,
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

test("contract: should return projects for authenticated reader", async () => {
  await withContractServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/projects`, {
      headers: { "x-role": "PLAYER", "x-user-id": "player-1" },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, [{ id: "project-1", name: "Harbor of Whispers", status: "active" }]);
  });
});

test("contract: should return memberships and support filtering", async () => {
  await withContractServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/memberships?project_id=project-1&user_id=gm-1`, {
      headers: { "x-role": "GM", "x-user-id": "gm-1" },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, [
      { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
    ]);
  });
});

test("contract: should allow GM and HELPER to create invites and deny PLAYER", async () => {
  await withContractServer(async ({ baseUrl }) => {
    const inviteBody = { project_id: "project-1", email: "new-player@example.com", role: "PLAYER" };

    const gmResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
      body: JSON.stringify(inviteBody),
    });
    assert.equal(gmResponse.status, 201);

    const helperResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "HELPER", "x-user-id": "helper-1" },
      body: JSON.stringify({ ...inviteBody, email: "helper-invite@example.com" }),
    });
    assert.equal(helperResponse.status, 201);

    const playerResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "PLAYER", "x-user-id": "player-1" },
      body: JSON.stringify(inviteBody),
    });

    assert.equal(playerResponse.status, 403);
    const payload = await playerResponse.json();
    assert.equal(payload.code, "FORBIDDEN");
  });
});
