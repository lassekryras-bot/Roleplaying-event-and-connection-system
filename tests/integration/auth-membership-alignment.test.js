import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";
import { authenticateUser } from "../../src/data/inMemoryAuthStore.js";
import { getMembershipByProjectAndUser, listMemberships } from "../../src/data/inMemoryStore.js";

async function withServer(handler) {
  const server = createServer({
    getThreadById: () => null,
    listThreads: () => [],
    listMemberships,
    getProjectMembershipByUserId: getMembershipByProjectAndUser,
    createProjectInvite: (projectId, invitePayload) => ({
      id: "invite-1",
      project_id: projectId,
      ...invitePayload,
    }),
    authenticateUser,
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

test("login responses stay aligned with seeded project memberships", async () => {
  await withServer(async ({ baseUrl }) => {
    const users = [
      { username: "Admingm", password: "1234", role: "GM", userId: "gm-1", inviteStatus: 201 },
      { username: "Admingmhelper", password: "1234", role: "HELPER", userId: "helper-1", inviteStatus: 201 },
      { username: "Adminplayer", password: "1234", role: "PLAYER", userId: "player-1", inviteStatus: 403 },
    ];

    for (const user of users) {
      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user.username, password: user.password }),
      });

      assert.equal(loginResponse.status, 200);

      const loginPayload = await loginResponse.json();
      assert.deepEqual(loginPayload, {
        user_id: user.userId,
        username: user.username,
        role: user.role,
      });

      const authHeaders = {
        "x-role": loginPayload.role,
        "x-user-id": loginPayload.user_id,
      };

      const membershipsResponse = await fetch(
        `${baseUrl}/memberships?project_id=project-1&user_id=${encodeURIComponent(loginPayload.user_id)}`,
        { headers: authHeaders },
      );

      assert.equal(membershipsResponse.status, 200);
      assert.deepEqual(await membershipsResponse.json(), [
        {
          project_id: "project-1",
          user_id: user.userId,
          role: user.role,
          status: "active",
        },
      ]);

      const inviteResponse = await fetch(`${baseUrl}/projects/project-1/invites`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: `${user.role.toLowerCase()}@example.com`,
          role: "PLAYER",
        }),
      });

      assert.equal(inviteResponse.status, user.inviteStatus);
    }
  });
});
