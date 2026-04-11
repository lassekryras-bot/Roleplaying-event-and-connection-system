import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../../src/api/createServer.js";
import { authenticateUser } from "../../src/data/inMemoryAuthStore.js";

async function withServer(handler) {
  const server = createServer({
    getThreadById: () => null,
    listThreads: () => [],
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

test("auth login succeeds for each hardcoded user", async () => {
  await withServer(async ({ baseUrl }) => {
    const users = [
      { username: "Adminplayer", password: "1234", user_id: "player-1", role: "PLAYER" },
      { username: "Admingm", password: "1234", user_id: "gm-1", role: "GM" },
      { username: "Admingmhelper", password: "1234", user_id: "helper-1", role: "HELPER" },
    ];

    for (const user of users) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          password: user.password,
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      });
    }
  });
});

test("auth login returns 401 for an invalid password or unknown username", async () => {
  await withServer(async ({ baseUrl }) => {
    const cases = [
      { username: "Admingm", password: "wrong-password" },
      { username: "Unknownuser", password: "1234" },
    ];

    for (const credentials of cases) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        code: "INVALID_CREDENTIALS",
        error: "invalid username or password",
      });
    }
  });
});

test("auth login returns 400 for malformed JSON and missing fields", async () => {
  await withServer(async ({ baseUrl }) => {
    const malformedJsonResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ invalid-json",
    });
    const missingUsernameResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "1234" }),
    });
    const missingPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Admingm" }),
    });

    assert.equal(malformedJsonResponse.status, 400);
    assert.deepEqual(await malformedJsonResponse.json(), {
      code: "INVALID_JSON",
      error: "invalid JSON body",
    });

    assert.equal(missingUsernameResponse.status, 400);
    assert.deepEqual(await missingUsernameResponse.json(), {
      code: "USERNAME_REQUIRED",
      error: "username is required",
    });

    assert.equal(missingPasswordResponse.status, 400);
    assert.deepEqual(await missingPasswordResponse.json(), {
      code: "PASSWORD_REQUIRED",
      error: "password is required",
    });
  });
});
