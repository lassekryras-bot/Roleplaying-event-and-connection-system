import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withServer(handler) {
  const threads = [
    {
      id: "thread-1",
      project_id: "project-1",
      title: "Dockside Rumors",
      state: "active",
      gm_truth: "smugglers are backed by nobility",
      player_view: "smugglers are moving goods at night",
    },
  ];

  const memberships = [
    { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
    { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
  ];
  const preferredProjectsByUserId = new Map();

  const events = [
    {
      id: "event-1",
      timeline_position: "past",
      project_id: "project-1",
      gm_truth: "the harbor master is compromised",
      player_view: "the harbor master looks nervous",
    },
  ];

  const server = createServer({
    getThreadById: (threadId) => threads.find((thread) => thread.id === threadId) ?? null,
    listThreads: () => threads.map((thread) => ({ ...thread })),
    listEvents: () => events.map((event) => ({ ...event })),
    createProjectMembership: (projectId, membershipPayload) => ({ id: "membership-2", project_id: projectId, ...membershipPayload }),
    createProjectInvite: (projectId, invitePayload) => ({ id: "invite-1", project_id: projectId, ...invitePayload }),
    listProjects: () => [{ id: "project-1", name: "Coverage Project", status: "active" }],
    getPreferredProjectIdForUser: (userId) => preferredProjectsByUserId.get(userId) ?? null,
    savePreferredProjectIdForUser: (userId, projectId) => {
      preferredProjectsByUserId.set(userId, projectId);
      return projectId;
    },
    saveThreadState: (threadId, state) => {
      const existing = threads.find((thread) => thread.id === threadId);
      existing.state = state;
      return { ...existing };
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

test("covers success and validation branches for createServer", async () => {
  await withServer(async ({ baseUrl }) => {
    const gmHeaders = { "x-role": "GM", "x-user-id": "gm-1", "content-type": "application/json" };

    const writeEndpointsResponse = await fetch(`${baseUrl}/meta/write-endpoints`);
    assert.equal(writeEndpointsResponse.status, 200);
    const writeEndpointsPayload = await writeEndpointsResponse.json();
    assert.equal(writeEndpointsPayload.write_endpoints.length, 6);
    assert.deepEqual(
      writeEndpointsPayload.write_endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
      [
        "POST /projects/:projectId/commands",
        "POST /projects/:projectId/history/undo",
        "POST /projects/:projectId/history/redo",
        "PATCH /threads/:threadId",
        "POST /projects/:projectId/memberships",
        "POST /projects/:projectId/invites",
      ],
    );

    const missingRoleThreadsResponse = await fetch(`${baseUrl}/threads`);
    assert.equal(missingRoleThreadsResponse.status, 401);

    const unsupportedRoleThreadsResponse = await fetch(`${baseUrl}/threads`, {
      headers: { "x-role": "SPECTATOR", "x-user-id": "observer-1" },
    });
    assert.equal(unsupportedRoleThreadsResponse.status, 400);

    const unsupportedRoleTimelineResponse = await fetch(`${baseUrl}/timeline/events`, {
      headers: { "x-role": "SPECTATOR", "x-user-id": "observer-1" },
    });
    assert.equal(unsupportedRoleTimelineResponse.status, 400);

    const forbiddenMembershipResponse = await fetch(`${baseUrl}/projects/project-1/memberships`, {
      method: "POST",
      headers: { "x-role": "HELPER", "x-user-id": "gm-1", "content-type": "application/json" },
      body: JSON.stringify({ user_id: "player-1", role: "PLAYER", status: "active" }),
    });
    assert.equal(forbiddenMembershipResponse.status, 403);

    const createdMembershipResponse = await fetch(`${baseUrl}/projects/project-1/memberships`, {
      method: "POST",
      headers: gmHeaders,
      body: JSON.stringify({ user_id: "player-1", role: "PLAYER", status: "active" }),
    });
    assert.equal(createdMembershipResponse.status, 201);

    const createdProjectInviteResponse = await fetch(`${baseUrl}/projects/project-1/invites`, {
      method: "POST",
      headers: gmHeaders,
      body: JSON.stringify({ email: "new-player@example.com", role: "PLAYER" }),
    });
    assert.equal(createdProjectInviteResponse.status, 201);

    const initialPreferenceResponse = await fetch(`${baseUrl}/preferences/selected-project`, {
      headers: gmHeaders,
    });
    assert.equal(initialPreferenceResponse.status, 200);
    assert.deepEqual(await initialPreferenceResponse.json(), { project_id: null });

    const savedPreferenceResponse = await fetch(`${baseUrl}/preferences/selected-project`, {
      method: "POST",
      headers: gmHeaders,
      body: JSON.stringify({ project_id: "project-1" }),
    });
    assert.equal(savedPreferenceResponse.status, 200);
    assert.deepEqual(await savedPreferenceResponse.json(), { project_id: "project-1" });

    const currentPreferenceResponse = await fetch(`${baseUrl}/preferences/selected-project`, {
      headers: gmHeaders,
    });
    assert.equal(currentPreferenceResponse.status, 200);
    assert.deepEqual(await currentPreferenceResponse.json(), { project_id: "project-1" });

    const invalidThreadTransitionResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: gmHeaders,
      body: JSON.stringify({ state: "not-a-real-state" }),
    });
    assert.equal(invalidThreadTransitionResponse.status, 400);

    const validThreadTransitionResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers: gmHeaders,
      body: JSON.stringify({ state: "resolved" }),
    });
    assert.equal(validThreadTransitionResponse.status, 200);

    const unknownThreadResponse = await fetch(`${baseUrl}/threads/unknown-thread`, {
      headers: { "x-role": "GM", "x-user-id": "gm-1" },
    });
    assert.equal(unknownThreadResponse.status, 404);

    const unsupportedRoleThreadDetail = await fetch(`${baseUrl}/threads/thread-1`, {
      headers: { "x-role": "SPECTATOR", "x-user-id": "observer-1" },
    });
    assert.equal(unsupportedRoleThreadDetail.status, 400);
  });
});
