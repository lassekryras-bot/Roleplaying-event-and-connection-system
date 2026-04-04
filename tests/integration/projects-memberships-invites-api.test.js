import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withTestServer(handler) {
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

test("should list projects on GET /projects", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/projects`, {
      headers: { "x-role": "PLAYER", "x-user-id": "player-1" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, [{ id: "project-1", name: "Harbor of Whispers", status: "active" }]);
  });
});

test("should list memberships on GET /memberships", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/memberships?project_id=project-1`, {
      headers: { "x-role": "GM", "x-user-id": "gm-1" },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.length, 3);
    assert.equal(payload[0].project_id, "project-1");
  });
});

test("should allow GM and HELPER writes to POST /invites and deny PLAYER", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const commonBody = { project_id: "project-1", email: "invitee@example.com", role: "PLAYER" };

    const gmResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
      body: JSON.stringify(commonBody),
    });
    assert.equal(gmResponse.status, 201);

    const helperResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "HELPER", "x-user-id": "helper-1" },
      body: JSON.stringify({ ...commonBody, email: "helper@example.com" }),
    });
    assert.equal(helperResponse.status, 201);

    const playerResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "PLAYER", "x-user-id": "player-1" },
      body: JSON.stringify(commonBody),
    });
    const playerPayload = await playerResponse.json();

    assert.equal(playerResponse.status, 403);
    assert.deepEqual(playerPayload, { error: "forbidden", code: "FORBIDDEN" });
  });
});

test("should return explicit error codes for malformed invite payload", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const invalidJsonResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
      body: "{ bad-json",
    });
    const invalidJsonPayload = await invalidJsonResponse.json();

    assert.equal(invalidJsonResponse.status, 400);
    assert.deepEqual(invalidJsonPayload, { code: "INVALID_JSON", error: "invalid JSON body" });

    const missingProjectResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "GM", "x-user-id": "gm-1" },
      body: JSON.stringify({ email: "nobody@example.com", role: "PLAYER" }),
    });
    const missingProjectPayload = await missingProjectResponse.json();

    assert.equal(missingProjectResponse.status, 400);
    assert.deepEqual(missingProjectPayload, {
      code: "PROJECT_ID_REQUIRED",
      error: "project_id is required",
    });
  });
});
