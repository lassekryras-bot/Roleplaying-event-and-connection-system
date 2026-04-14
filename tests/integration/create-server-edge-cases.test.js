import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";

async function withServer(overrides, handler) {
  const threads = [{ id: "thread-1", project_id: "project-1", state: "active", gm_truth: "secret" }];

  const server = createServer({
    getThreadById: (threadId) => threads.find((thread) => thread.id === threadId) ?? null,
    listThreads: () => threads.map((thread) => ({ ...thread })),
    ...overrides,
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await handler({ baseUrl });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("returns not implemented responses for optional route handlers", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const headers = { "x-role": "GM", "x-user-id": "gm-1" };

    const projectsResponse = await fetch(`${baseUrl}/projects`, { headers });
    const preferenceResponse = await fetch(`${baseUrl}/preferences/selected-project`, { headers });
    const membershipsResponse = await fetch(`${baseUrl}/memberships`, { headers });
    const invitesResponse = await fetch(`${baseUrl}/invites`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ project_id: "project-1", email: "invite@example.com", role: "PLAYER" }),
    });
    const timelineResponse = await fetch(`${baseUrl}/timeline/events`, { headers });
    const projectMembershipResponse = await fetch(`${baseUrl}/projects/project-1/memberships`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ user_id: "player-2", role: "PLAYER" }),
    });
    const projectInviteResponse = await fetch(`${baseUrl}/projects/project-1/invites`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ email: "invite@example.com", role: "PLAYER" }),
    });

    assert.equal(projectsResponse.status, 501);
    assert.equal(preferenceResponse.status, 501);
    assert.equal(membershipsResponse.status, 501);
    assert.equal(invitesResponse.status, 501);
    assert.equal(timelineResponse.status, 501);
    assert.equal(projectMembershipResponse.status, 501);
    assert.equal(projectInviteResponse.status, 501);

    assert.deepEqual(await projectsResponse.json(), {
      code: "NOT_IMPLEMENTED",
      error: "projects endpoint not implemented",
    });
    assert.deepEqual(await preferenceResponse.json(), {
      code: "NOT_IMPLEMENTED",
      error: "selected project preference endpoint not implemented",
    });
    assert.deepEqual(await membershipsResponse.json(), {
      code: "NOT_IMPLEMENTED",
      error: "memberships endpoint not implemented",
    });
    assert.deepEqual(await invitesResponse.json(), {
      code: "NOT_IMPLEMENTED",
      error: "invites endpoint not implemented",
    });
    assert.deepEqual(await timelineResponse.json(), { error: "timeline endpoint not implemented" });
    assert.deepEqual(await projectMembershipResponse.json(), {
      error: "project membership endpoint not implemented",
    });
    assert.deepEqual(await projectInviteResponse.json(), { error: "project invite endpoint not implemented" });
  });
});

test("handles JSON parsing failures and missing handlers on thread updates", async () => {
  await withServer({
    saveThreadState: undefined,
    createProjectInvite: () => ({}),
    getProjectMembershipByUserId: () => ({ role: "GM", status: "active" }),
  }, async ({ baseUrl }) => {
    const headers = {
      "x-role": "GM",
      "x-user-id": "gm-1",
      "content-type": "application/json",
    };

    const invalidProjectInvite = await fetch(`${baseUrl}/projects/project-1/invites`, {
      method: "POST",
      headers,
      body: "{ bad-json",
    });
    const invalidProjectInvitePayload = await invalidProjectInvite.json();

    const missingThreadResponse = await fetch(`${baseUrl}/threads/missing-thread`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "resolved" }),
    });
    const missingThreadPayload = await missingThreadResponse.json();

    const notImplementedPatchResponse = await fetch(`${baseUrl}/threads/thread-1`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "resolved" }),
    });
    const notImplementedPatchPayload = await notImplementedPatchResponse.json();

    assert.equal(invalidProjectInvite.status, 400);
    assert.deepEqual(invalidProjectInvitePayload, {
      code: "INVALID_JSON",
      error: "invalid JSON body",
    });
    assert.equal(missingThreadResponse.status, 404);
    assert.deepEqual(missingThreadPayload, { error: "thread not found" });
    assert.equal(notImplementedPatchResponse.status, 501);
    assert.deepEqual(notImplementedPatchPayload, { error: "thread transition endpoint not implemented" });
  });
});

test("returns health and not-found responses", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    const notFoundResponse = await fetch(`${baseUrl}/does-not-exist`);

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: "ok" });

    assert.equal(notFoundResponse.status, 404);
    assert.deepEqual(await notFoundResponse.json(), { error: "not found" });
  });
});

test("responds to browser preflight requests and exposes CORS headers", async () => {
  await withServer({}, async ({ baseUrl }) => {
    const preflightResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    assert.equal(preflightResponse.status, 204);
    assert.equal(preflightResponse.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.match(preflightResponse.headers.get("access-control-allow-methods") ?? "", /POST/);
    assert.match(preflightResponse.headers.get("access-control-allow-headers") ?? "", /content-type/i);
  });
});

test("handles auth login success and stable error responses", async () => {
  await withServer({
    authenticateUser: (username, password) => {
      if (username === "player" && password === "secret") {
        return { user_id: "player-1", username: "player", role: "PLAYER" };
      }

      return null;
    },
  }, async ({ baseUrl }) => {
    const successfulLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player", password: "secret" }),
    });
    const invalidCredentials = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player", password: "wrong" }),
    });
    const invalidJson = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad-json",
    });
    const invalidRequest = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(["player", "secret"]),
    });
    const missingUsername = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });
    const missingPassword = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player" }),
    });

    assert.equal(successfulLogin.status, 200);
    assert.deepEqual(await successfulLogin.json(), {
      user_id: "player-1",
      username: "player",
      role: "PLAYER",
    });

    assert.equal(invalidCredentials.status, 401);
    assert.deepEqual(await invalidCredentials.json(), {
      code: "INVALID_CREDENTIALS",
      error: "invalid username or password",
    });

    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), {
      code: "INVALID_JSON",
      error: "invalid JSON body",
    });

    assert.equal(invalidRequest.status, 400);
    assert.deepEqual(await invalidRequest.json(), {
      code: "INVALID_REQUEST",
      error: "request body must be a JSON object",
    });

    assert.equal(missingUsername.status, 400);
    assert.deepEqual(await missingUsername.json(), {
      code: "USERNAME_REQUIRED",
      error: "username is required",
    });

    assert.equal(missingPassword.status, 400);
    assert.deepEqual(await missingPassword.json(), {
      code: "PASSWORD_REQUIRED",
      error: "password is required",
    });
  });
});
