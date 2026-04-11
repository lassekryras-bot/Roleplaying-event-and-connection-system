import type {
  BoardMode,
  BoardPerspectiveAccess,
  BoardPerspectiveRevealOverrides,
  BoardPlayerProfile,
  BoardPattern,
  BoardThread,
  ProjectBoardData,
} from './types';

function isStagedThread(thread: BoardThread) {
  return thread.staging?.isStaged === true;
}

function isStagedPattern(pattern: BoardPattern) {
  return pattern.staging?.isStaged === true;
}

function getPlayerVisibleEntityIdsFromThreads(data: ProjectBoardData, threadIds: Set<string>) {
  const entityIds = new Set<string>();

  for (const thread of data.threads) {
    if (isStagedThread(thread) || !threadIds.has(thread.id)) {
      continue;
    }

    for (const entityId of thread.linkedEntityIds) {
      if (data.linkedEntities[entityId]?.playerVisible) {
        entityIds.add(entityId);
      }
    }
  }

  return entityIds;
}

function getRevealedNodeIds(revealOverrides?: BoardPerspectiveRevealOverrides) {
  return new Set([
    ...(revealOverrides?.globalNodeIds ?? []),
    ...(revealOverrides?.playerNodeIds ?? []),
  ]);
}

export function buildPlayerPerspectiveAccess(
  data: ProjectBoardData,
  mode: BoardMode,
  playerProfile: BoardPlayerProfile | null,
  revealOverrides?: BoardPerspectiveRevealOverrides,
): BoardPerspectiveAccess | null {
  if (mode !== 'player' || !playerProfile) {
    return null;
  }

  const revealedNodeIds = getRevealedNodeIds(revealOverrides);
  const revealedPatternIds = new Set(
    data.patterns.filter((pattern) => !isStagedPattern(pattern) && revealedNodeIds.has(pattern.id)).map((pattern) => pattern.id),
  );
  const revealedThreadIds = new Set(
    data.threads.filter((thread) => !isStagedThread(thread) && revealedNodeIds.has(thread.id)).map((thread) => thread.id),
  );
  const accessiblePatternIds = new Set<string>([
    playerProfile.patternId,
    ...(playerProfile.perspectivePatternIds ?? []),
    ...revealedPatternIds,
  ]);
  const explicitThreadIds = new Set<string>([
    ...(playerProfile.perspectiveThreadIds ?? []),
    ...revealedThreadIds,
  ]);
  const accessibleThreadIds = new Set<string>();

  for (const thread of data.threads) {
    if (isStagedThread(thread)) {
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

  let accessibleEntityIds = getPlayerVisibleEntityIdsFromThreads(data, accessibleThreadIds);

  for (const thread of data.threads) {
    if (isStagedThread(thread) || accessibleThreadIds.has(thread.id) || !thread.playerVisible) {
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

  accessibleEntityIds = getPlayerVisibleEntityIdsFromThreads(data, accessibleThreadIds);

  return {
    accessiblePatternIds,
    accessibleThreadIds,
    accessibleEntityIds,
  };
}

export function scopeProjectBoardDataForPerspective(
  data: ProjectBoardData,
  mode: BoardMode,
  playerProfile: BoardPlayerProfile | null,
  perspectiveAccess?: BoardPerspectiveAccess | null,
): ProjectBoardData {
  if (mode !== 'player' || !playerProfile) {
    return data;
  }

  const access = perspectiveAccess ?? buildPlayerPerspectiveAccess(data, mode, playerProfile);

  if (!access) {
    return data;
  }

  const scopedPatterns = data.patterns
    .filter((pattern) => !isStagedPattern(pattern) && access.accessiblePatternIds.has(pattern.id))
    .map((pattern) => ({
      ...pattern,
      threadIds: pattern.threadIds.filter((threadId) => access.accessibleThreadIds.has(threadId)),
    }));
  const scopedThreads = data.threads.filter((thread) => !isStagedThread(thread) && access.accessibleThreadIds.has(thread.id));
  const scopedLinkedEntities = Object.fromEntries(
    Object.entries(data.linkedEntities).filter(
      ([entityId, entity]) => entity.playerVisible && access.accessibleEntityIds.has(entityId),
    ),
  );

  return {
    ...data,
    patterns: scopedPatterns,
    threads: scopedThreads,
    linkedEntities: scopedLinkedEntities,
  };
}
