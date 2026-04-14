import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createFileCampaignStore } from "../../src/data/fileCampaignStore.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function withTempCampaignStore(callback) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "campaign-store-"));

  try {
    const store = createFileCampaignStore({ rootDir });
    callback({ rootDir, store });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test("file campaign store seeds campaigns, persists sharing, and rewinds history", () => {
  withTempCampaignStore(({ rootDir, store }) => {
    const projects = store.listProjects({ role: "GM", userId: "gm-1" });
    assert.equal(projects.length, 3);

    const initialGraph = store.getProjectGraph({
      projectId: "project-1",
      view: "gm",
      role: "GM",
      userId: "gm-1",
    });
    assert.equal(initialGraph.history.totalRevisions, 1);
    assert.equal(initialGraph.history.headIndex, 0);

    const shareResult = store.executeProjectCommand({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
      command: {
        kind: "share_node_to_player",
        nodeId: "pattern-ash-ritual",
        playerUserId: "player-1",
      },
    });

    assert.equal(shareResult.revision.commandKind, "share_node_to_player");
    assert.equal(shareResult.graph.history.totalRevisions, 2);
    assert.equal(shareResult.graph.history.headIndex, 1);

    const sharingPath = path.join(rootDir, "project-1", "sharing.json");
    const historyIndexPath = path.join(rootDir, "project-1", "history", "index.json");
    const revisionPath = path.join(rootDir, "project-1", "history", "revisions", "revision-0002.json");

    const sharing = readJson(sharingPath);
    const historyIndex = readJson(historyIndexPath);
    const revision = readJson(revisionPath);

    assert.deepEqual(sharing.globalNodeIds, []);
    assert.ok(sharing.playerNodeIdsByPlayer["player-1"].includes("pattern-ash-ritual"));
    assert.deepEqual(historyIndex.revisionIds, ["revision-0001", "revision-0002"]);
    assert.equal(historyIndex.headIndex, 1);
    assert.equal(revision.commandKind, "share_node_to_player");

    const playerGraph = store.getProjectGraph({
      projectId: "project-1",
      view: "player",
      role: "PLAYER",
      userId: "player-1",
    });
    assert.ok(playerGraph.patterns.some((pattern) => pattern.id === "pattern-ash-ritual"));

    const undoResult = store.undoProjectHistory({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
    });
    assert.equal(undoResult.graph.history.headIndex, 0);

    const sharingAfterUndo = readJson(sharingPath);
    assert.ok(!sharingAfterUndo.playerNodeIdsByPlayer["player-1"].includes("pattern-ash-ritual"));

    const redoResult = store.redoProjectHistory({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
    });
    assert.equal(redoResult.graph.history.headIndex, 1);

    const sharingAfterRedo = readJson(sharingPath);
    assert.ok(sharingAfterRedo.playerNodeIdsByPlayer["player-1"].includes("pattern-ash-ritual"));
  });
});

test("saveThreadState persists thread changes through the command adapter", () => {
  withTempCampaignStore(({ rootDir, store }) => {
    const updatedThread = store.saveThreadState("thread-whispers-harbor", "resolved", {
      role: "GM",
      userId: "gm-1",
    });

    assert.equal(updatedThread.state, "resolved");

    const threadPath = path.join(rootDir, "project-1", "threads", "thread-whispers-harbor.json");
    const historyIndexPath = path.join(rootDir, "project-1", "history", "index.json");

    const persistedThread = readJson(threadPath);
    const historyIndex = readJson(historyIndexPath);

    assert.equal(persistedThread.state, "resolved");
    assert.equal(historyIndex.revisionIds.length, 2);
    assert.equal(historyIndex.headIndex, 1);
  });
});

test("file campaign store creates staged notes, activates them, and restores them through undo/redo", () => {
  withTempCampaignStore(({ rootDir, store }) => {
    const createThreadResult = store.executeProjectCommand({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
      command: {
        kind: "create_thread",
        title: "Staged Test Thread",
        trayAnchor: "now",
      },
    });

    const stagedThread = createThreadResult.graph.threads.find((thread) => thread.title === "Staged Test Thread");
    assert.ok(stagedThread);
    assert.deepEqual(stagedThread.staging, {
      isStaged: true,
      trayAnchor: "now",
    });

    const persistedThread = readJson(
      path.join(rootDir, "project-1", "threads", `${stagedThread.id}.json`),
    );
    assert.deepEqual(persistedThread.staging, {
      isStaged: true,
      trayAnchor: "now",
    });

    const createPatternResult = store.executeProjectCommand({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
      command: {
        kind: "create_pattern",
        title: "Staged Test Pattern",
        trayAnchor: "future_possible",
      },
    });

    const stagedPattern = createPatternResult.graph.patterns.find((pattern) => pattern.title === "Staged Test Pattern");
    assert.ok(stagedPattern);
    assert.deepEqual(stagedPattern.staging, {
      isStaged: true,
      trayAnchor: "future_possible",
    });

    const activateResult = store.executeProjectCommand({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
      command: {
        kind: "activate_staged_note",
        noteId: stagedThread.id,
        targetNodeId: "thread-whispers-harbor",
      },
    });

    const activatedThread = activateResult.graph.threads.find((thread) => thread.id === stagedThread.id);
    assert.ok(activatedThread);
    assert.equal(activatedThread.state, "active");
    assert.equal(activatedThread.playerVisible, false);
    assert.equal(activatedThread.staging, undefined);
    assert.ok(
      activateResult.graph.manualLinks.some(
        (link) =>
          link.id === `manual-${[stagedThread.id, "thread-whispers-harbor"].sort().join("-")}`,
      ),
    );

    const historyIndexPath = path.join(rootDir, "project-1", "history", "index.json");
    const historyIndex = readJson(historyIndexPath);
    assert.equal(historyIndex.revisionIds.length, 4);
    assert.equal(historyIndex.headIndex, 3);

    const undoResult = store.undoProjectHistory({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
    });
    const undoneThread = undoResult.graph.threads.find((thread) => thread.id === stagedThread.id);
    assert.ok(undoneThread);
    assert.deepEqual(undoneThread.staging, {
      isStaged: true,
      trayAnchor: "now",
    });

    const redoResult = store.redoProjectHistory({
      projectId: "project-1",
      actorRole: "GM",
      actorUserId: "gm-1",
    });
    const redoneThread = redoResult.graph.threads.find((thread) => thread.id === stagedThread.id);
    assert.ok(redoneThread);
    assert.equal(redoneThread.staging, undefined);
    assert.equal(redoneThread.state, "active");
  });
});

test("file campaign store persists the preferred project per user in a file", () => {
  withTempCampaignStore(({ rootDir, store }) => {
    const savedProjectId = store.savePreferredProjectIdForUser("gm-1", "project-3");
    assert.equal(savedProjectId, "project-3");
    assert.equal(store.getPreferredProjectIdForUser("gm-1"), "project-3");

    const preferencePath = path.join(rootDir, ".user-preferences.json");
    const preferences = readJson(preferencePath);

    assert.equal(preferences.users["gm-1"].selectedProjectId, "project-3");
    assert.equal(typeof preferences.users["gm-1"].updatedAt, "string");
  });
});
