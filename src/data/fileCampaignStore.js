import fs from "node:fs";
import path from "node:path";

import { transitionThreadState } from "../threads/threadStateMachine.js";
import { createSeedCampaignSnapshots } from "./campaignSeedData.js";

const DEFAULT_CAMPAIGNS_ROOT = path.join(process.cwd(), "campaigns");
const INITIAL_REVISION_ID = "revision-0001";
const STAGING_ANCHORS = new Set(["past", "now", "future_possible"]);

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugifyTitle(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStaging(staging) {
  if (
    !staging ||
    typeof staging !== "object" ||
    staging.isStaged !== true ||
    !STAGING_ANCHORS.has(staging.trayAnchor)
  ) {
    return undefined;
  }

  return {
    isStaged: true,
    trayAnchor: staging.trayAnchor,
  };
}

function isStagedNote(note) {
  return note?.staging?.isStaged === true;
}

function normalizeAnchor(value, fallback = "now") {
  return STAGING_ANCHORS.has(value) ? value : fallback;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeJsonAtomic(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  const tempFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(tempFilePath, json, "utf8");

  try {
    fs.renameSync(tempFilePath, filePath);
  } catch {
    fs.rmSync(filePath, { force: true });
    fs.renameSync(tempFilePath, filePath);
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => readJsonFile(path.join(directoryPath, entry)));
}

function createInitialHistoryIndex() {
  return {
    revisionIds: [INITIAL_REVISION_ID],
    headIndex: 0,
  };
}

function createInitialRevision(snapshot) {
  return {
    id: INITIAL_REVISION_ID,
    projectId: snapshot.project.id,
    actorUserId: "system",
    actorRole: "GM",
    commandKind: "seed_campaign",
    summary: "Initial campaign import",
    createdAt: new Date(0).toISOString(),
    snapshot,
  };
}

function normalizeSharing(playerProfiles, sharing) {
  const safeSharing = sharing && typeof sharing === "object" ? cloneValue(sharing) : {};
  const playerNodeIdsByPlayer = safeSharing.playerNodeIdsByPlayer ?? {};

  for (const profile of playerProfiles) {
    if (!Array.isArray(playerNodeIdsByPlayer[profile.userId])) {
      playerNodeIdsByPlayer[profile.userId] = [];
    }
  }

  return {
    globalNodeIds: Array.isArray(safeSharing.globalNodeIds) ? [...new Set(safeSharing.globalNodeIds)] : [],
    playerNodeIdsByPlayer,
  };
}

function normalizeManualLinks(manualLinks) {
  if (!Array.isArray(manualLinks)) {
    return [];
  }

  const seenIds = new Set();
  const normalized = [];

  for (const link of manualLinks) {
    if (!link || typeof link !== "object") {
      continue;
    }

    if (
      typeof link.id !== "string" ||
      typeof link.sourceId !== "string" ||
      typeof link.targetId !== "string" ||
      link.sourceId === link.targetId
    ) {
      continue;
    }

    if (seenIds.has(link.id)) {
      continue;
    }

    seenIds.add(link.id);
    normalized.push({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
    });
  }

  return normalized;
}

function normalizeSnapshot(snapshot) {
  const clonedSnapshot = cloneValue(snapshot);
  clonedSnapshot.threads = Array.isArray(clonedSnapshot.threads)
    ? clonedSnapshot.threads.map((thread) => ({
        ...thread,
        staging: normalizeStaging(thread.staging),
      }))
    : [];
  clonedSnapshot.patterns = Array.isArray(clonedSnapshot.patterns)
    ? clonedSnapshot.patterns.map((pattern) => ({
        ...pattern,
        staging: normalizeStaging(pattern.staging),
      }))
    : [];
  clonedSnapshot.manualLinks = normalizeManualLinks(clonedSnapshot.manualLinks);
  clonedSnapshot.sharing = normalizeSharing(clonedSnapshot.playerProfiles ?? [], clonedSnapshot.sharing);
  return clonedSnapshot;
}

function getCampaignPaths(rootDir, projectId) {
  const projectDir = path.join(rootDir, projectId);

  return {
    projectDir,
    projectFile: path.join(projectDir, "project.json"),
    nowFile: path.join(projectDir, "now.json"),
    playerProfilesFile: path.join(projectDir, "player-profiles.json"),
    threadsDir: path.join(projectDir, "threads"),
    patternsDir: path.join(projectDir, "patterns"),
    entitiesDir: path.join(projectDir, "entities"),
    linksDir: path.join(projectDir, "links"),
    manualLinksFile: path.join(projectDir, "links", "manual-links.json"),
    sharingFile: path.join(projectDir, "sharing.json"),
    historyDir: path.join(projectDir, "history"),
    historyIndexFile: path.join(projectDir, "history", "index.json"),
    revisionsDir: path.join(projectDir, "history", "revisions"),
  };
}

function persistCampaignSnapshot(rootDir, snapshot) {
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const paths = getCampaignPaths(rootDir, normalizedSnapshot.project.id);

  ensureDirectory(paths.projectDir);
  ensureDirectory(paths.threadsDir);
  ensureDirectory(paths.patternsDir);
  ensureDirectory(paths.entitiesDir);
  ensureDirectory(paths.linksDir);
  ensureDirectory(paths.revisionsDir);

  for (const existingFile of fs.readdirSync(paths.threadsDir)) {
    if (existingFile.endsWith(".json")) {
      fs.rmSync(path.join(paths.threadsDir, existingFile), { force: true });
    }
  }

  for (const existingFile of fs.readdirSync(paths.patternsDir)) {
    if (existingFile.endsWith(".json")) {
      fs.rmSync(path.join(paths.patternsDir, existingFile), { force: true });
    }
  }

  for (const existingFile of fs.readdirSync(paths.entitiesDir)) {
    if (existingFile.endsWith(".json")) {
      fs.rmSync(path.join(paths.entitiesDir, existingFile), { force: true });
    }
  }

  writeJsonAtomic(paths.projectFile, normalizedSnapshot.project);
  writeJsonAtomic(paths.nowFile, normalizedSnapshot.now);
  writeJsonAtomic(paths.playerProfilesFile, normalizedSnapshot.playerProfiles);
  writeJsonAtomic(paths.manualLinksFile, normalizedSnapshot.manualLinks);
  writeJsonAtomic(paths.sharingFile, normalizedSnapshot.sharing);

  for (const thread of normalizedSnapshot.threads) {
    writeJsonAtomic(path.join(paths.threadsDir, `${thread.id}.json`), thread);
  }

  for (const pattern of normalizedSnapshot.patterns) {
    writeJsonAtomic(path.join(paths.patternsDir, `${pattern.id}.json`), pattern);
  }

  for (const entity of Object.values(normalizedSnapshot.linkedEntities)) {
    writeJsonAtomic(path.join(paths.entitiesDir, `${entity.id}.json`), entity);
  }
}

export function ensureSeedCampaignFiles(rootDir = DEFAULT_CAMPAIGNS_ROOT) {
  ensureDirectory(rootDir);

  for (const snapshot of createSeedCampaignSnapshots()) {
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    const paths = getCampaignPaths(rootDir, normalizedSnapshot.project.id);

    if (fs.existsSync(paths.projectFile)) {
      continue;
    }

    persistCampaignSnapshot(rootDir, normalizedSnapshot);
    const historyIndex = createInitialHistoryIndex();
    const initialRevision = createInitialRevision(normalizedSnapshot);
    writeJsonAtomic(paths.historyIndexFile, historyIndex);
    writeJsonAtomic(path.join(paths.revisionsDir, `${INITIAL_REVISION_ID}.json`), initialRevision);
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("campaign snapshot must be an object");
  }

  if (typeof snapshot.project?.id !== "string" || typeof snapshot.project?.name !== "string") {
    throw new Error("campaign project metadata is invalid");
  }

  if (!Array.isArray(snapshot.threads) || !Array.isArray(snapshot.patterns) || !Array.isArray(snapshot.playerProfiles)) {
    throw new Error(`campaign ${snapshot.project.id} is missing required arrays`);
  }

  return snapshot;
}

function loadCampaignSnapshot(rootDir, projectId) {
  const paths = getCampaignPaths(rootDir, projectId);

  if (!fs.existsSync(paths.projectFile)) {
    return null;
  }

  const snapshot = validateSnapshot({
    project: readJsonFile(paths.projectFile),
    now: readJsonFile(paths.nowFile),
    playerProfiles: readJsonFile(paths.playerProfilesFile),
    threads: listJsonFiles(paths.threadsDir),
    patterns: listJsonFiles(paths.patternsDir),
    linkedEntities: Object.fromEntries(
      listJsonFiles(paths.entitiesDir).map((entity) => [entity.id, entity]),
    ),
    manualLinks: fs.existsSync(paths.manualLinksFile) ? readJsonFile(paths.manualLinksFile) : [],
    sharing: fs.existsSync(paths.sharingFile)
      ? readJsonFile(paths.sharingFile)
      : { globalNodeIds: [], playerNodeIdsByPlayer: {} },
  });

  return normalizeSnapshot(snapshot);
}

function loadHistoryIndex(rootDir, projectId) {
  const paths = getCampaignPaths(rootDir, projectId);

  if (!fs.existsSync(paths.historyIndexFile)) {
    return createInitialHistoryIndex();
  }

  const index = readJsonFile(paths.historyIndexFile);
  const revisionIds = Array.isArray(index.revisionIds)
    ? index.revisionIds.filter((value) => typeof value === "string")
    : [INITIAL_REVISION_ID];
  const maxHeadIndex = Math.max(0, revisionIds.length - 1);
  const headIndex = Number.isInteger(index.headIndex)
    ? Math.min(Math.max(index.headIndex, 0), maxHeadIndex)
    : maxHeadIndex;

  return {
    revisionIds,
    headIndex,
  };
}

function loadRevision(rootDir, projectId, revisionId) {
  const paths = getCampaignPaths(rootDir, projectId);
  const revisionPath = path.join(paths.revisionsDir, `${revisionId}.json`);

  if (!fs.existsSync(revisionPath)) {
    return null;
  }

  return readJsonFile(revisionPath);
}

function listCampaignIds(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function syncPatternThreadIds(snapshot) {
  const nextPatterns = snapshot.patterns.map((pattern) => ({
    ...pattern,
    threadIds: [],
  }));
  const patternById = new Map(nextPatterns.map((pattern) => [pattern.id, pattern]));

  for (const thread of snapshot.threads) {
    if (!thread.patternId) {
      continue;
    }

    const pattern = patternById.get(thread.patternId);
    if (pattern) {
      pattern.threadIds.push(thread.id);
    }
  }

  return {
    ...snapshot,
    patterns: nextPatterns.map((pattern) => ({
      ...pattern,
      threadIds: [...new Set(pattern.threadIds)],
    })),
  };
}

function getPlayerVisibleEntityIdsFromThreads(snapshot, threadIds) {
  const entityIds = new Set();

  for (const thread of snapshot.threads) {
    if (!threadIds.has(thread.id)) {
      continue;
    }

    for (const entityId of thread.linkedEntityIds) {
      if (snapshot.linkedEntities[entityId]?.playerVisible) {
        entityIds.add(entityId);
      }
    }
  }

  return entityIds;
}

function buildRevealOverrides(snapshot, playerUserId) {
  return {
    globalNodeIds: snapshot.sharing.globalNodeIds ?? [],
    playerNodeIds: snapshot.sharing.playerNodeIdsByPlayer?.[playerUserId] ?? [],
  };
}

function buildPlayerPerspectiveAccess(snapshot, playerProfile, revealOverrides = { globalNodeIds: [], playerNodeIds: [] }) {
  if (!playerProfile) {
    return {
      accessiblePatternIds: new Set(),
      accessibleThreadIds: new Set(),
      accessibleEntityIds: new Set(),
    };
  }

  const revealedNodeIds = new Set([...(revealOverrides.globalNodeIds ?? []), ...(revealOverrides.playerNodeIds ?? [])]);
  const revealedPatternIds = new Set(
    snapshot.patterns.filter((pattern) => revealedNodeIds.has(pattern.id)).map((pattern) => pattern.id),
  );
  const revealedThreadIds = new Set(
    snapshot.threads.filter((thread) => revealedNodeIds.has(thread.id)).map((thread) => thread.id),
  );
  const accessiblePatternIds = new Set([
    playerProfile.patternId,
    ...(playerProfile.perspectivePatternIds ?? []),
    ...revealedPatternIds,
  ]);
  const explicitThreadIds = new Set([
    ...(playerProfile.perspectiveThreadIds ?? []),
    ...revealedThreadIds,
  ]);
  const accessibleThreadIds = new Set();

  for (const thread of snapshot.threads) {
    if (isStagedNote(thread)) {
      continue;
    }

    const isRevealedThread = revealedThreadIds.has(thread.id);

    if (isRevealedThread) {
      accessibleThreadIds.add(thread.id);
      if (thread.patternId) {
        accessiblePatternIds.add(thread.patternId);
      }
      continue;
    }

    if (!thread.playerVisible) {
      continue;
    }

    if (explicitThreadIds.has(thread.id)) {
      accessibleThreadIds.add(thread.id);
      if (thread.patternId) {
        accessiblePatternIds.add(thread.patternId);
      }
      continue;
    }

    if (thread.patternId && accessiblePatternIds.has(thread.patternId)) {
      accessibleThreadIds.add(thread.id);
    }
  }

  let accessibleEntityIds = getPlayerVisibleEntityIdsFromThreads(snapshot, accessibleThreadIds);

  for (const thread of snapshot.threads) {
    if (isStagedNote(thread) || accessibleThreadIds.has(thread.id) || !thread.playerVisible) {
      continue;
    }

    const sharesVisibleEntity = thread.linkedEntityIds.some((entityId) => accessibleEntityIds.has(entityId));

    if (!sharesVisibleEntity) {
      continue;
    }

    accessibleThreadIds.add(thread.id);
    if (thread.patternId) {
      accessiblePatternIds.add(thread.patternId);
    }
  }

  accessibleEntityIds = getPlayerVisibleEntityIdsFromThreads(snapshot, accessibleThreadIds);

  return {
    accessiblePatternIds,
    accessibleThreadIds,
    accessibleEntityIds,
  };
}

function scopeSnapshotForPlayer(snapshot, playerProfile) {
  if (!playerProfile) {
    return {
      ...snapshot,
      threads: [],
      patterns: [],
      linkedEntities: {},
      manualLinks: [],
    };
  }

  const revealOverrides = buildRevealOverrides(snapshot, playerProfile.userId);
  const access = buildPlayerPerspectiveAccess(snapshot, playerProfile, revealOverrides);
  const patterns = snapshot.patterns
    .filter((pattern) => !isStagedNote(pattern) && access.accessiblePatternIds.has(pattern.id))
    .map((pattern) => ({
      ...pattern,
      threadIds: pattern.threadIds.filter((threadId) => access.accessibleThreadIds.has(threadId)),
      summary: pattern.playerVisible ? pattern.summary : "",
    }));
  const threads = snapshot.threads
    .filter((thread) => !isStagedNote(thread) && access.accessibleThreadIds.has(thread.id))
    .map((thread) => ({
      ...thread,
      gmTruth: undefined,
    }));
  const linkedEntities = Object.fromEntries(
    Object.entries(snapshot.linkedEntities).filter(
      ([entityId, entity]) => entity.playerVisible && access.accessibleEntityIds.has(entityId),
    ),
  );
  const manualLinks = snapshot.manualLinks
    .filter(
      (link) => access.accessibleThreadIds.has(link.sourceId) || access.accessiblePatternIds.has(link.sourceId),
    )
    .filter(
      (link) => access.accessibleThreadIds.has(link.targetId) || access.accessiblePatternIds.has(link.targetId),
    );

  return {
    ...snapshot,
    patterns,
    threads,
    linkedEntities,
    manualLinks,
  };
}

function summarizeTimeline(threads) {
  const summary = { past: 0, now: 0, future: 0 };

  for (const thread of threads) {
    if (isStagedNote(thread)) {
      continue;
    }

    if (thread.timelineAnchor === "future_possible") {
      summary.future += 1;
      continue;
    }

    if (thread.timelineAnchor === "past" || thread.timelineAnchor === "now") {
      summary[thread.timelineAnchor] += 1;
    }
  }

  return summary;
}

function rootDirFromHistoryIndex(historyIndex) {
  return historyIndex.__rootDir;
}

function attachHistoryRoot(historyIndex, rootDir) {
  return {
    ...historyIndex,
    __rootDir: rootDir,
  };
}

function getRevisionSummary(rootDir, projectId, historyIndex) {
  if (!rootDir) {
    return null;
  }

  const headRevisionId = historyIndex.revisionIds[historyIndex.headIndex];
  const headRevision = headRevisionId ? loadRevision(rootDir, projectId, headRevisionId) : null;

  if (!headRevision) {
    return null;
  }

  return {
    id: headRevision.id,
    commandKind: headRevision.commandKind,
    summary: headRevision.summary,
    createdAt: headRevision.createdAt,
  };
}

function buildGraphPayload(snapshot, { mode, role, playerUserId = null, historyIndex }) {
  const playerProfile = playerUserId
    ? snapshot.playerProfiles.find((profile) => profile.userId === playerUserId) ?? null
    : null;
  const effectiveSnapshot = role === "PLAYER" ? scopeSnapshotForPlayer(snapshot, playerProfile) : snapshot;

  return {
    project: cloneValue(effectiveSnapshot.project),
    now: cloneValue(effectiveSnapshot.now),
    threads: cloneValue(effectiveSnapshot.threads),
    patterns: cloneValue(effectiveSnapshot.patterns),
    linkedEntities: cloneValue(effectiveSnapshot.linkedEntities),
    playerProfiles: cloneValue(snapshot.playerProfiles),
    manualLinks: cloneValue(effectiveSnapshot.manualLinks),
    sharing: cloneValue(snapshot.sharing),
    edges: [],
    timelineSummary: summarizeTimeline(effectiveSnapshot.threads),
    mode,
    revision: getRevisionSummary(rootDirFromHistoryIndex(historyIndex), snapshot.project.id, historyIndex),
    history: {
      totalRevisions: historyIndex.revisionIds.length,
      headIndex: historyIndex.headIndex,
      canUndo: historyIndex.headIndex > 0,
      canRedo: historyIndex.headIndex < historyIndex.revisionIds.length - 1,
    },
  };
}

function toThreadApi(snapshot, thread) {
  return {
    id: thread.id,
    project_id: snapshot.project.id,
    title: thread.title,
    state: thread.state,
    hook: thread.hook,
    player_summary: thread.playerSummary,
    gm_truth: thread.gmTruth,
    timeline_anchor: thread.timelineAnchor,
    linked_entity_ids: thread.linkedEntityIds,
    pattern_id: thread.patternId,
    player_visible: thread.playerVisible,
  };
}

function toTimelineEvent(snapshot, thread, sequence) {
  return {
    id: `event-${thread.id}`,
    project_id: snapshot.project.id,
    type: "thread",
    label: thread.title,
    timeline_position: thread.timelineAnchor,
    sequence,
    player_summary: thread.playerSummary,
    gm_truth: thread.gmTruth,
  };
}

function buildMemberships(snapshot, extraMemberships) {
  const memberships = [
    { project_id: snapshot.project.id, user_id: "gm-1", role: "GM", status: "active" },
    { project_id: snapshot.project.id, user_id: "helper-1", role: "HELPER", status: "active" },
    ...snapshot.playerProfiles.map((profile) => ({
      project_id: snapshot.project.id,
      user_id: profile.userId,
      role: "PLAYER",
      status: "active",
    })),
  ];

  for (const membership of extraMemberships) {
    if (membership.project_id === snapshot.project.id) {
      memberships.push({ ...membership });
    }
  }

  const uniqueMemberships = new Map();
  for (const membership of memberships) {
    uniqueMemberships.set(`${membership.project_id}:${membership.user_id}`, membership);
  }

  return [...uniqueMemberships.values()];
}

function buildAccessibleSnapshotMap(rootDir) {
  const snapshots = listCampaignIds(rootDir)
    .map((projectId) => loadCampaignSnapshot(rootDir, projectId))
    .filter(Boolean);

  return new Map(snapshots.map((snapshot) => [snapshot.project.id, snapshot]));
}

function findSnapshotContainingThread(snapshots, threadId) {
  for (const snapshot of snapshots.values()) {
    const thread = snapshot.threads.find((entry) => entry.id === threadId);
    if (thread) {
      return { snapshot, thread };
    }
  }

  return null;
}

function assertNodeExists(snapshot, nodeId) {
  const exists =
    nodeId === snapshot.now.id ||
    snapshot.threads.some((thread) => thread.id === nodeId) ||
    snapshot.patterns.some((pattern) => pattern.id === nodeId);

  if (!exists) {
    const error = new Error(`Node ${nodeId} was not found.`);
    error.statusCode = 404;
    error.code = "NODE_NOT_FOUND";
    throw error;
  }
}

function findThreadById(snapshot, threadId) {
  return snapshot.threads.find((thread) => thread.id === threadId) ?? null;
}

function findPatternById(snapshot, patternId) {
  return snapshot.patterns.find((pattern) => pattern.id === patternId) ?? null;
}

function findNoteById(snapshot, noteId) {
  return findThreadById(snapshot, noteId) ?? findPatternById(snapshot, noteId);
}

function generateUniqueNoteId(snapshot, prefix, title) {
  const baseSlug = slugifyTitle(title) || `${prefix}-note`;
  const baseId = `${prefix}-${baseSlug}`;
  const existingIds = new Set([
    ...snapshot.threads.map((thread) => thread.id),
    ...snapshot.patterns.map((pattern) => pattern.id),
    snapshot.now.id,
  ]);

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function assertCanShareNode(snapshot, actorRole, actorUserId, nodeId) {
  assertNodeExists(snapshot, nodeId);

  if (actorRole === "GM" || actorRole === "HELPER") {
    return;
  }

  if (actorRole !== "PLAYER") {
    const error = new Error("Only active members can share notes.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  const playerProfile = snapshot.playerProfiles.find((profile) => profile.userId === actorUserId) ?? null;
  const access = buildPlayerPerspectiveAccess(snapshot, playerProfile, buildRevealOverrides(snapshot, actorUserId));
  const accessible =
    access.accessiblePatternIds.has(nodeId) ||
    access.accessibleThreadIds.has(nodeId) ||
    nodeId === snapshot.now.id;

  if (!accessible) {
    const error = new Error("Players can only share notes they can already access.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

function createRevisionId(historyIndex) {
  return `revision-${String(historyIndex.revisionIds.length + 1).padStart(4, "0")}`;
}

function updateArrayValue(values, nextValue) {
  return values.includes(nextValue) ? values : [...values, nextValue];
}

function removeArrayValue(values, valueToRemove) {
  return values.filter((value) => value !== valueToRemove);
}

function appendRevision(rootDir, snapshot, historyIndex, actorUserId, actorRole, commandKind, summary) {
  const paths = getCampaignPaths(rootDir, snapshot.project.id);
  const truncatedRevisionIds = historyIndex.revisionIds.slice(0, historyIndex.headIndex + 1);
  const nextRevisionId = createRevisionId({ revisionIds: truncatedRevisionIds });
  const revision = {
    id: nextRevisionId,
    projectId: snapshot.project.id,
    actorUserId,
    actorRole,
    commandKind,
    summary,
    createdAt: new Date().toISOString(),
    snapshot: normalizeSnapshot(snapshot),
  };
  const nextHistoryIndex = {
    revisionIds: [...truncatedRevisionIds, nextRevisionId],
    headIndex: truncatedRevisionIds.length,
  };

  writeJsonAtomic(path.join(paths.revisionsDir, `${nextRevisionId}.json`), revision);
  writeJsonAtomic(paths.historyIndexFile, nextHistoryIndex);

  return {
    revision,
    historyIndex: nextHistoryIndex,
  };
}

function restoreRevision(rootDir, projectId, revisionId, headIndex, revisionIds) {
  const revision = loadRevision(rootDir, projectId, revisionId);
  if (!revision) {
    const error = new Error(`Revision ${revisionId} was not found.`);
    error.statusCode = 404;
    error.code = "REVISION_NOT_FOUND";
    throw error;
  }

  persistCampaignSnapshot(rootDir, revision.snapshot);
  writeJsonAtomic(getCampaignPaths(rootDir, projectId).historyIndexFile, {
    revisionIds,
    headIndex,
  });

  return revision;
}

function applyProjectCommand(snapshot, command, actorRole, actorUserId) {
  const nextSnapshot = normalizeSnapshot(syncPatternThreadIds(snapshot));
  const commandBody = cloneValue(command);

  switch (command.kind) {
    case "update_thread": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can edit thread content.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      const thread = nextSnapshot.threads.find((entry) => entry.id === commandBody.threadId);
      if (!thread) {
        const error = new Error("Thread not found.");
        error.statusCode = 404;
        error.code = "THREAD_NOT_FOUND";
        throw error;
      }

      if (typeof commandBody.state === "string" && commandBody.state !== thread.state) {
        const transitionedThread = transitionThreadState({ state: thread.state }, commandBody.state);
        thread.state = transitionedThread.state;
      }

      if (typeof commandBody.title === "string") {
        thread.title = commandBody.title.trim();
      }
      if (typeof commandBody.hook === "string" || commandBody.hook === null) {
        thread.hook = commandBody.hook ?? undefined;
      }
      if (typeof commandBody.playerSummary === "string") {
        thread.playerSummary = commandBody.playerSummary;
      }
      if (typeof commandBody.gmTruth === "string" || commandBody.gmTruth === null) {
        thread.gmTruth = commandBody.gmTruth ?? undefined;
      }
      if (typeof commandBody.timelineAnchor === "string") {
        thread.timelineAnchor = commandBody.timelineAnchor;
      }
      if (Array.isArray(commandBody.linkedEntityIds)) {
        thread.linkedEntityIds = [...new Set(commandBody.linkedEntityIds)];
      }
      if (typeof commandBody.patternId === "string" || commandBody.patternId === null) {
        thread.patternId = commandBody.patternId ?? undefined;
      }
      if (typeof commandBody.playerVisible === "boolean") {
        thread.playerVisible = commandBody.playerVisible;
      }

      return {
        snapshot: syncPatternThreadIds(nextSnapshot),
        summary: `Updated thread ${thread.title}`,
      };
    }
    case "update_pattern": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can edit pattern content.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      const pattern = nextSnapshot.patterns.find((entry) => entry.id === commandBody.patternId);
      if (!pattern) {
        const error = new Error("Pattern not found.");
        error.statusCode = 404;
        error.code = "PATTERN_NOT_FOUND";
        throw error;
      }

      if (typeof commandBody.title === "string") {
        pattern.title = commandBody.title.trim();
      }
      if (typeof commandBody.summary === "string") {
        pattern.summary = commandBody.summary;
      }
      if (typeof commandBody.escalationLevel === "number") {
        pattern.escalationLevel = commandBody.escalationLevel;
      }
      if (typeof commandBody.playerVisible === "boolean") {
        pattern.playerVisible = commandBody.playerVisible;
      }

      return {
        snapshot: nextSnapshot,
        summary: `Updated pattern ${pattern.title}`,
      };
    }
    case "update_now": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can edit the current moment.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      if (typeof commandBody.title === "string") {
        nextSnapshot.now.title = commandBody.title.trim();
      }
      if (typeof commandBody.playerSummary === "string") {
        nextSnapshot.now.playerSummary = commandBody.playerSummary;
      }
      if (typeof commandBody.gmTruth === "string" || commandBody.gmTruth === null) {
        nextSnapshot.now.gmTruth = commandBody.gmTruth ?? undefined;
      }

      return {
        snapshot: nextSnapshot,
        summary: "Updated current moment",
      };
    }
    case "create_thread": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can create staged threads.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      const title = typeof commandBody.title === "string" ? commandBody.title.trim() : "";
      if (!title) {
        const error = new Error("Thread title is required.");
        error.statusCode = 400;
        error.code = "TITLE_REQUIRED";
        throw error;
      }

      const trayAnchor = normalizeAnchor(commandBody.trayAnchor);
      const threadId = generateUniqueNoteId(nextSnapshot, "thread", title);

      nextSnapshot.threads.push({
        id: threadId,
        title,
        state: "dormant",
        hook: typeof commandBody.hook === "string" ? commandBody.hook : undefined,
        playerSummary: typeof commandBody.playerSummary === "string" ? commandBody.playerSummary : "",
        gmTruth:
          typeof commandBody.gmTruth === "string" ? commandBody.gmTruth : undefined,
        timelineAnchor: trayAnchor,
        linkedEntityIds: [],
        playerVisible: false,
        staging: {
          isStaged: true,
          trayAnchor,
        },
      });

      return {
        snapshot: syncPatternThreadIds(nextSnapshot),
        summary: `Created staged thread ${title}`,
      };
    }
    case "create_pattern": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can create staged patterns.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      const title = typeof commandBody.title === "string" ? commandBody.title.trim() : "";
      if (!title) {
        const error = new Error("Pattern title is required.");
        error.statusCode = 400;
        error.code = "TITLE_REQUIRED";
        throw error;
      }

      const trayAnchor = normalizeAnchor(commandBody.trayAnchor);
      const patternId = generateUniqueNoteId(nextSnapshot, "pattern", title);

      nextSnapshot.patterns.push({
        id: patternId,
        title,
        summary: typeof commandBody.summary === "string" ? commandBody.summary : "",
        escalationLevel:
          typeof commandBody.escalationLevel === "number" && Number.isFinite(commandBody.escalationLevel)
            ? commandBody.escalationLevel
            : 1,
        threadIds: [],
        playerVisible: false,
        staging: {
          isStaged: true,
          trayAnchor,
        },
      });

      return {
        snapshot: syncPatternThreadIds(nextSnapshot),
        summary: `Created staged pattern ${title}`,
      };
    }
    case "activate_staged_note": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can activate staged notes.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      assertNodeExists(nextSnapshot, commandBody.noteId);
      assertNodeExists(nextSnapshot, commandBody.targetNodeId);

      if (commandBody.noteId === nextSnapshot.now.id) {
        const error = new Error("NOW cannot be activated as a staged note.");
        error.statusCode = 400;
        error.code = "INVALID_NOTE";
        throw error;
      }

      if (commandBody.noteId === commandBody.targetNodeId) {
        return {
          snapshot: nextSnapshot,
          summary: "Ignored self-link",
        };
      }

      const note = findNoteById(nextSnapshot, commandBody.noteId);
      if (!isStagedNote(note)) {
        const error = new Error("Only staged notes can be activated.");
        error.statusCode = 400;
        error.code = "NOTE_NOT_STAGED";
        throw error;
      }

      const [sourceId, targetId] = [commandBody.noteId, commandBody.targetNodeId].sort((left, right) =>
        left.localeCompare(right),
      );
      const linkId = `manual-${sourceId}-${targetId}`;

      if (!nextSnapshot.manualLinks.some((link) => link.id === linkId)) {
        nextSnapshot.manualLinks.push({
          id: linkId,
          sourceId,
          targetId,
        });
      }

      note.staging = undefined;
      note.playerVisible = false;

      if ("state" in note && note.state !== "active") {
        const transitionedThread = transitionThreadState({ state: note.state }, "active");
        note.state = transitionedThread.state;
      }

      return {
        snapshot: syncPatternThreadIds(nextSnapshot),
        summary: `Activated ${note.title}`,
      };
    }
    case "create_manual_link": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can create manual links.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      assertNodeExists(nextSnapshot, commandBody.sourceId);
      assertNodeExists(nextSnapshot, commandBody.targetId);
      if (isStagedNote(findNoteById(nextSnapshot, commandBody.sourceId)) || isStagedNote(findNoteById(nextSnapshot, commandBody.targetId))) {
        const error = new Error("Staged notes cannot receive manual links until activated.");
        error.statusCode = 400;
        error.code = "NOTE_NOT_ACTIVE";
        throw error;
      }
      if (commandBody.sourceId === commandBody.targetId) {
        return { snapshot: nextSnapshot, summary: "Ignored self-link" };
      }

      const [sourceId, targetId] = [commandBody.sourceId, commandBody.targetId].sort((left, right) =>
        left.localeCompare(right),
      );
      const linkId = `manual-${sourceId}-${targetId}`;

      if (!nextSnapshot.manualLinks.some((link) => link.id === linkId)) {
        nextSnapshot.manualLinks.push({
          id: linkId,
          sourceId,
          targetId,
        });
      }

      return {
        snapshot: nextSnapshot,
        summary: `Linked ${sourceId} to ${targetId}`,
      };
    }
    case "delete_manual_link": {
      if (actorRole !== "GM") {
        const error = new Error("Only GM can remove manual links.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      nextSnapshot.manualLinks = nextSnapshot.manualLinks.filter((link) => link.id !== commandBody.linkId);
      return {
        snapshot: nextSnapshot,
        summary: `Removed manual link ${commandBody.linkId}`,
      };
    }
    case "share_node_to_player": {
      assertCanShareNode(nextSnapshot, actorRole, actorUserId, commandBody.nodeId);
      const targetProfile = nextSnapshot.playerProfiles.find((profile) => profile.userId === commandBody.playerUserId);
      if (!targetProfile) {
        const error = new Error("Target player was not found.");
        error.statusCode = 404;
        error.code = "PLAYER_NOT_FOUND";
        throw error;
      }

      nextSnapshot.sharing.playerNodeIdsByPlayer[targetProfile.userId] = updateArrayValue(
        nextSnapshot.sharing.playerNodeIdsByPlayer[targetProfile.userId] ?? [],
        commandBody.nodeId,
      );
      return {
        snapshot: nextSnapshot,
        summary: `Shared ${commandBody.nodeId} with ${targetProfile.displayName}`,
      };
    }
    case "share_node_to_all": {
      assertCanShareNode(nextSnapshot, actorRole, actorUserId, commandBody.nodeId);
      nextSnapshot.sharing.globalNodeIds = updateArrayValue(
        nextSnapshot.sharing.globalNodeIds,
        commandBody.nodeId,
      );
      return {
        snapshot: nextSnapshot,
        summary: `Shared ${commandBody.nodeId} with all players`,
      };
    }
    case "unshare_node_from_player": {
      if (actorRole !== "GM" && actorRole !== "HELPER") {
        const error = new Error("Only GM and helper can revoke direct shares.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      nextSnapshot.sharing.playerNodeIdsByPlayer[commandBody.playerUserId] = removeArrayValue(
        nextSnapshot.sharing.playerNodeIdsByPlayer[commandBody.playerUserId] ?? [],
        commandBody.nodeId,
      );
      return {
        snapshot: nextSnapshot,
        summary: `Revoked ${commandBody.nodeId} from ${commandBody.playerUserId}`,
      };
    }
    case "unshare_node_from_all": {
      if (actorRole !== "GM" && actorRole !== "HELPER") {
        const error = new Error("Only GM and helper can revoke global shares.");
        error.statusCode = 403;
        error.code = "FORBIDDEN";
        throw error;
      }

      nextSnapshot.sharing.globalNodeIds = removeArrayValue(nextSnapshot.sharing.globalNodeIds, commandBody.nodeId);
      return {
        snapshot: nextSnapshot,
        summary: `Revoked ${commandBody.nodeId} from all players`,
      };
    }
    default: {
      const error = new Error(`Unsupported command kind: ${commandBody.kind}`);
      error.statusCode = 400;
      error.code = "INVALID_COMMAND";
      throw error;
    }
  }
}

export function createFileCampaignStore({ rootDir = DEFAULT_CAMPAIGNS_ROOT } = {}) {
  ensureSeedCampaignFiles(rootDir);
  const extraMemberships = [];
  const invites = [];

  function loadSnapshots() {
    return buildAccessibleSnapshotMap(rootDir);
  }

  function getMembership(projectId, userId) {
    if (!projectId || !userId) {
      return null;
    }

    const snapshot = loadCampaignSnapshot(rootDir, projectId);
    if (!snapshot) {
      return null;
    }

    return (
      buildMemberships(snapshot, extraMemberships).find(
        (membership) => membership.project_id === projectId && membership.user_id === userId,
      ) ?? null
    );
  }

  function listProjectsForContext({ role, userId } = {}) {
    return [...loadSnapshots().values()]
      .filter((snapshot) => {
        if (role === "GM" || role === "HELPER") {
          return true;
        }

        if (role === "PLAYER") {
          return Boolean(getMembership(snapshot.project.id, userId));
        }

        return true;
      })
      .map((snapshot) => ({ ...snapshot.project }));
  }

  function listThreadsForContext({ role, userId } = {}) {
    const snapshots = loadSnapshots();
    const threads = [];

    for (const snapshot of snapshots.values()) {
      const playerProfile =
        role === "PLAYER"
          ? snapshot.playerProfiles.find((profile) => profile.userId === userId) ?? null
          : null;
      const sourceSnapshot = role === "PLAYER" ? scopeSnapshotForPlayer(snapshot, playerProfile) : snapshot;

      for (const thread of sourceSnapshot.threads) {
        threads.push(toThreadApi(snapshot, thread));
      }
    }

    return threads;
  }

  function getThreadByIdForContext(threadId, { role, userId } = {}) {
    const snapshots = loadSnapshots();
    const match = findSnapshotContainingThread(snapshots, threadId);

    if (!match) {
      return null;
    }

    const { snapshot, thread } = match;

    if (role === "PLAYER") {
      const playerProfile = snapshot.playerProfiles.find((profile) => profile.userId === userId) ?? null;
      const scopedSnapshot = scopeSnapshotForPlayer(snapshot, playerProfile);
      const accessibleThread = scopedSnapshot.threads.find((entry) => entry.id === threadId);

      if (!accessibleThread) {
        return null;
      }

      return toThreadApi(snapshot, accessibleThread);
    }

    return toThreadApi(snapshot, thread);
  }

  function listEventsForContext({ role, userId } = {}) {
    const snapshots = loadSnapshots();
    const events = [];

    for (const snapshot of snapshots.values()) {
      const playerProfile =
        role === "PLAYER"
          ? snapshot.playerProfiles.find((profile) => profile.userId === userId) ?? null
          : null;
      const sourceSnapshot = role === "PLAYER" ? scopeSnapshotForPlayer(snapshot, playerProfile) : snapshot;

      sourceSnapshot.threads.forEach((thread, index) => {
        events.push(toTimelineEvent(snapshot, thread, index + 1));
      });
    }

    return events;
  }

  function getProjectGraph({
    projectId,
    view = "gm",
    role,
    userId,
    playerUserId,
  }) {
    const snapshot = loadCampaignSnapshot(rootDir, projectId);
    if (!snapshot) {
      return null;
    }

    const historyIndex = attachHistoryRoot(loadHistoryIndex(rootDir, projectId), rootDir);
    const effectiveMode = role === "PLAYER" ? "player" : view;
    const previewPlayerUserId =
      role === "PLAYER"
        ? userId
        : effectiveMode === "player"
          ? playerUserId ?? snapshot.playerProfiles[0]?.userId ?? null
          : null;

    return buildGraphPayload(snapshot, {
      mode: effectiveMode,
      role,
      playerUserId: previewPlayerUserId,
      historyIndex,
      includeAllSharing: role !== "PLAYER",
    });
  }

  function executeProjectCommand({
    projectId,
    command,
    actorRole,
    actorUserId,
  }) {
    const snapshot = loadCampaignSnapshot(rootDir, projectId);
    if (!snapshot) {
      const error = new Error("Project not found.");
      error.statusCode = 404;
      error.code = "PROJECT_NOT_FOUND";
      throw error;
    }

    const historyIndex = loadHistoryIndex(rootDir, projectId);
    const { snapshot: nextSnapshot, summary } = applyProjectCommand(snapshot, command, actorRole, actorUserId);
    const normalizedSnapshot = normalizeSnapshot(syncPatternThreadIds(nextSnapshot));

    persistCampaignSnapshot(rootDir, normalizedSnapshot);
    const { revision, historyIndex: nextHistoryIndex } = appendRevision(
      rootDir,
      normalizedSnapshot,
      historyIndex,
      actorUserId,
      actorRole,
      command.kind,
      summary,
    );

    return {
      revision: {
        id: revision.id,
        commandKind: revision.commandKind,
        summary: revision.summary,
        createdAt: revision.createdAt,
      },
      graph: buildGraphPayload(normalizedSnapshot, {
        mode: actorRole === "PLAYER" ? "player" : "gm",
        role: actorRole,
        playerUserId: actorRole === "PLAYER" ? actorUserId : null,
        historyIndex: attachHistoryRoot(nextHistoryIndex, rootDir),
        includeAllSharing: actorRole !== "PLAYER",
      }),
    };
  }

  function getProjectHistory(projectId) {
    const snapshot = loadCampaignSnapshot(rootDir, projectId);
    if (!snapshot) {
      return null;
    }

    const historyIndex = loadHistoryIndex(rootDir, projectId);
    const revisions = historyIndex.revisionIds
      .map((revisionId) => loadRevision(rootDir, projectId, revisionId))
      .filter(Boolean)
      .map((revision) => ({
        id: revision.id,
        commandKind: revision.commandKind,
        summary: revision.summary,
        createdAt: revision.createdAt,
        actorUserId: revision.actorUserId,
        actorRole: revision.actorRole,
      }));

    return {
      revisions,
      headIndex: historyIndex.headIndex,
      canUndo: historyIndex.headIndex > 0,
      canRedo: historyIndex.headIndex < historyIndex.revisionIds.length - 1,
    };
  }

  function undoProjectHistory({ projectId, actorRole }) {
    if (actorRole !== "GM") {
      const error = new Error("Only GM can undo changes.");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    const historyIndex = loadHistoryIndex(rootDir, projectId);
    if (historyIndex.headIndex <= 0) {
      const snapshot = loadCampaignSnapshot(rootDir, projectId);
      return {
        revision: getRevisionSummary(rootDir, projectId, attachHistoryRoot(historyIndex, rootDir)),
        graph: buildGraphPayload(snapshot, {
          mode: "gm",
          role: actorRole,
          historyIndex: attachHistoryRoot(historyIndex, rootDir),
        }),
      };
    }

    const nextHeadIndex = historyIndex.headIndex - 1;
    const revisionIds = historyIndex.revisionIds;
    const revisionId = revisionIds[nextHeadIndex];
    const revision = restoreRevision(rootDir, projectId, revisionId, nextHeadIndex, revisionIds);
    const restoredSnapshot = loadCampaignSnapshot(rootDir, projectId);
    const nextHistoryIndex = attachHistoryRoot(
      {
        revisionIds,
        headIndex: nextHeadIndex,
      },
      rootDir,
    );

    return {
      revision: {
        id: revision.id,
        commandKind: revision.commandKind,
        summary: revision.summary,
        createdAt: revision.createdAt,
      },
      graph: buildGraphPayload(restoredSnapshot, {
        mode: "gm",
        role: actorRole,
        historyIndex: nextHistoryIndex,
      }),
    };
  }

  function redoProjectHistory({ projectId, actorRole }) {
    if (actorRole !== "GM") {
      const error = new Error("Only GM can redo changes.");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    const historyIndex = loadHistoryIndex(rootDir, projectId);
    if (historyIndex.headIndex >= historyIndex.revisionIds.length - 1) {
      const snapshot = loadCampaignSnapshot(rootDir, projectId);
      return {
        revision: getRevisionSummary(rootDir, projectId, attachHistoryRoot(historyIndex, rootDir)),
        graph: buildGraphPayload(snapshot, {
          mode: "gm",
          role: actorRole,
          historyIndex: attachHistoryRoot(historyIndex, rootDir),
        }),
      };
    }

    const nextHeadIndex = historyIndex.headIndex + 1;
    const revisionIds = historyIndex.revisionIds;
    const revisionId = revisionIds[nextHeadIndex];
    const revision = restoreRevision(rootDir, projectId, revisionId, nextHeadIndex, revisionIds);
    const restoredSnapshot = loadCampaignSnapshot(rootDir, projectId);
    const nextHistoryIndex = attachHistoryRoot(
      {
        revisionIds,
        headIndex: nextHeadIndex,
      },
      rootDir,
    );

    return {
      revision: {
        id: revision.id,
        commandKind: revision.commandKind,
        summary: revision.summary,
        createdAt: revision.createdAt,
      },
      graph: buildGraphPayload(restoredSnapshot, {
        mode: "gm",
        role: actorRole,
        historyIndex: nextHistoryIndex,
      }),
    };
  }

  function saveThreadState(threadId, state, { role = "GM", userId = "gm-1" } = {}) {
    const snapshots = loadSnapshots();
    const match = findSnapshotContainingThread(snapshots, threadId);

    if (!match) {
      return null;
    }

    executeProjectCommand({
      projectId: match.snapshot.project.id,
      command: {
        kind: "update_thread",
        threadId,
        state,
      },
      actorRole: role,
      actorUserId: userId,
    });

    const nextSnapshot = loadCampaignSnapshot(rootDir, match.snapshot.project.id);
    const updatedThread = nextSnapshot.threads.find((thread) => thread.id === threadId);
    return updatedThread ? toThreadApi(nextSnapshot, updatedThread) : null;
  }

  return {
    rootDir,
    ensureSeedCampaignFiles: () => ensureSeedCampaignFiles(rootDir),
    listProjects: listProjectsForContext,
    listThreads: listThreadsForContext,
    getThreadById: getThreadByIdForContext,
    listEvents: listEventsForContext,
    listMemberships({ projectId, userId } = {}) {
      const memberships = [...loadSnapshots().values()].flatMap((snapshot) =>
        buildMemberships(snapshot, extraMemberships),
      );
      return memberships.filter((membership) => {
        if (projectId && membership.project_id !== projectId) {
          return false;
        }
        if (userId && membership.user_id !== userId) {
          return false;
        }
        return true;
      });
    },
    getProjectMembershipByUserId: getMembership,
    createMembership(projectId, data) {
      const createdMembership = {
        project_id: projectId,
        user_id: data.user_id,
        role: data.role,
        status: "active",
      };
      extraMemberships.push(createdMembership);
      return { ...createdMembership };
    },
    createInvite(projectId, data) {
      const invite = {
        id: `invite-${invites.length + 1}`,
        project_id: projectId,
        email: data.email,
        role: data.role,
      };
      invites.push(invite);
      return { ...invite };
    },
    getProjectGraph,
    executeProjectCommand,
    getProjectHistory,
    undoProjectHistory,
    redoProjectHistory,
    saveThreadState,
  };
}
