import assert from "node:assert/strict";

export const steps = new Map([
  [
    "a project exists with active gm helper and player memberships",
    async (world) => {
      world.memberships = [
        { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
        { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
        { project_id: "project-1", user_id: "player-1", role: "PLAYER", status: "active" },
      ];
      world.invites = [];
    },
  ],
  [
    "I am authenticated as a GM for that project",
    async (world) => {
      world.role = "GM";
      world.userId = "gm-1";
    },
  ],
  [
    "I am authenticated as a Player for that project",
    async (world) => {
      world.role = "PLAYER";
      world.userId = "player-1";
    },
  ],
  [
    "I submit a valid invite payload",
    async (world) => {
      world.response = await fetch(`${world.baseUrl}/invites`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-role": world.role,
          "x-user-id": world.userId,
        },
        body: JSON.stringify({
          project_id: "project-1",
          email: "candidate@example.com",
          role: "PLAYER",
        }),
      });
      world.payload = await world.response.json();
    },
  ],
  [
    "the invite request should be created",
    async (world) => {
      assert.equal(world.response.status, 201);
      assert.equal(world.payload.project_id, "project-1");
      assert.equal(world.payload.email, "candidate@example.com");
    },
  ],
  [
    "the invite request should be forbidden",
    async (world) => {
      assert.equal(world.response.status, 403);
      assert.deepEqual(world.payload, { error: "forbidden", code: "FORBIDDEN" });
    },
  ],
]);
