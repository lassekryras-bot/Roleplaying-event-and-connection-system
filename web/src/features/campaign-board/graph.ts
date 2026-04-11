import type {
  BoardGraphEdge,
  BoardGraphNode,
  BoardGraphResult,
  BoardManualLink,
  BoardMode,
  BoardPattern,
  BoardPerspectiveAccess,
  BoardThread,
  DerivedConnectionReason,
  DerivedConnectionTier,
  DerivedThreatEdge,
  ProjectBoardData,
} from './types';
import { getBoardTimelineLabel, THREAD_STATE_META } from './types';

type BuildBoardGraphOptions = {
  data: ProjectBoardData;
  mode: BoardMode;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusedPatternId: string | null;
  centerNodeId?: string | null;
  manualLinks?: BoardManualLink[];
  derivedData?: ProjectBoardData;
  perspectiveAccess?: BoardPerspectiveAccess | null;
  showInaccessibleContext?: boolean;
};

function isStagedThread(thread: BoardThread) {
  return thread.staging?.isStaged === true;
}

function isStagedPattern(pattern: BoardPattern) {
  return pattern.staging?.isStaged === true;
}

const NOW_NODE_DIAMETER = 84;
const PATTERN_NODE_DIAMETER = 57;
const THREAD_NODE_DIAMETER = 38;
const PATTERN_RING_X = 360;
const PATTERN_RING_Y = 240;
const NOTE_GAP = 12;
const NOTE_HOVER_DIAMETER_BOOST = 11;
const STRONG_CONNECTION_THRESHOLD = 6;
const MEDIUM_CONNECTION_THRESHOLD = 3;
const WEAK_CONNECTION_THRESHOLD = 1.5;
const SHARED_PATTERN_WEIGHT = 4;
const SHARED_ENTITY_WEIGHT = 2;
const SHARED_ENTITY_CAP = 6;
const SAME_TIMELINE_WEIGHT = 1;
const ADJACENT_TIMELINE_WEIGHT = 0.5;
const BOTH_PRESSURED_WEIGHT = 1.5;
const PRESSURED_DORMANT_WEIGHT = 0.5;
const RESOLVED_THREAD_PENALTY = -1;

function isVisibleToMode(playerVisible: boolean, mode: BoardMode): boolean {
  return mode === 'gm' || playerVisible;
}

function sortByTitle<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.title.localeCompare(right.title));
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function isPressuredThread(thread: BoardThread): boolean {
  return thread.state === 'active' || thread.state === 'escalated';
}

function isAdjacentTimeline(
  leftAnchor: BoardThread['timelineAnchor'],
  rightAnchor: BoardThread['timelineAnchor'],
): boolean {
  return (
    (leftAnchor === 'past' && rightAnchor === 'now') ||
    (leftAnchor === 'now' && rightAnchor === 'past') ||
    (leftAnchor === 'now' && rightAnchor === 'future_possible') ||
    (leftAnchor === 'future_possible' && rightAnchor === 'now')
  );
}

function roundStrength(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNodePairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort((left, right) => left.localeCompare(right)).join('::');
}

export function getDerivedConnectionTier(strength: number): DerivedConnectionTier | null {
  if (strength >= STRONG_CONNECTION_THRESHOLD) {
    return 'strong';
  }

  if (strength >= MEDIUM_CONNECTION_THRESHOLD) {
    return 'medium';
  }

  if (strength >= WEAK_CONNECTION_THRESHOLD) {
    return 'weak';
  }

  return null;
}

type BuildDerivedThreatEdgesOptions = {
  data: ProjectBoardData;
  mode: BoardMode;
};

type ThreatPairSignalContext = {
  leftThread: BoardThread;
  rightThread: BoardThread;
  mode: BoardMode;
  data: ProjectBoardData;
};

export function scoreThreatPair({
  leftThread,
  rightThread,
  mode,
  data,
}: ThreatPairSignalContext): { strength: number; reasons: DerivedConnectionReason[] } {
  const reasons: DerivedConnectionReason[] = [];
  const visibleEntityIds = (thread: BoardThread) =>
    thread.linkedEntityIds.filter((entityId) => {
      if (mode === 'gm') {
        return true;
      }

      return data.linkedEntities[entityId]?.playerVisible ?? false;
    });

  if (
    leftThread.patternId &&
    leftThread.patternId === rightThread.patternId &&
    data.patterns.some((pattern) => pattern.id === leftThread.patternId)
  ) {
    const patternTitle =
      data.patterns.find((pattern) => pattern.id === leftThread.patternId)?.title ?? 'shared pattern';
    reasons.push({
      kind: 'pattern',
      label: `same pattern: ${patternTitle}`,
      weight: SHARED_PATTERN_WEIGHT,
    });
  }

  const sharedEntityIds = visibleEntityIds(leftThread).filter((entityId) => visibleEntityIds(rightThread).includes(entityId));
  for (const entityId of sharedEntityIds.slice(0, SHARED_ENTITY_CAP / SHARED_ENTITY_WEIGHT)) {
    const entity = data.linkedEntities[entityId];
    if (!entity) {
      continue;
    }

    reasons.push({
      kind: 'shared_entity',
      label: `shared entity: ${entity.name}`,
      weight: SHARED_ENTITY_WEIGHT,
    });
  }

  if (leftThread.timelineAnchor === rightThread.timelineAnchor) {
    reasons.push({
      kind: 'timeline',
      label: `same timeline: ${getBoardTimelineLabel(leftThread.timelineAnchor)}`,
      weight: SAME_TIMELINE_WEIGHT,
    });
  } else if (isAdjacentTimeline(leftThread.timelineAnchor, rightThread.timelineAnchor)) {
    reasons.push({
      kind: 'timeline',
      label: `adjacent timeline: ${getBoardTimelineLabel(leftThread.timelineAnchor)} / ${getBoardTimelineLabel(rightThread.timelineAnchor)}`,
      weight: ADJACENT_TIMELINE_WEIGHT,
    });
  }

  if (isPressuredThread(leftThread) && isPressuredThread(rightThread)) {
    reasons.push({
      kind: 'state',
      label: 'both pressured',
      weight: BOTH_PRESSURED_WEIGHT,
    });
  } else if (
    (isPressuredThread(leftThread) && rightThread.state === 'dormant') ||
    (isPressuredThread(rightThread) && leftThread.state === 'dormant')
  ) {
    reasons.push({
      kind: 'state',
      label: 'pressured + dormant',
      weight: PRESSURED_DORMANT_WEIGHT,
    });
  }

  if (leftThread.state === 'resolved' || rightThread.state === 'resolved') {
    reasons.push({
      kind: 'state',
      label: 'resolved thread present',
      weight: RESOLVED_THREAD_PENALTY,
    });
  }

  return {
    strength: roundStrength(reasons.reduce((sum, reason) => sum + reason.weight, 0)),
    reasons,
  };
}

export function buildDerivedThreatEdges({ data, mode }: BuildDerivedThreatEdgesOptions): DerivedThreatEdge[] {
  const roleVisibleThreads = sortById(data.threads.filter((thread) => isVisibleToMode(thread.playerVisible, mode)));
  const derivedEdges: DerivedThreatEdge[] = [];

  for (let leftIndex = 0; leftIndex < roleVisibleThreads.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < roleVisibleThreads.length; rightIndex += 1) {
      const leftThread = roleVisibleThreads[leftIndex];
      const rightThread = roleVisibleThreads[rightIndex];
      const { strength, reasons } = scoreThreatPair({
        leftThread,
        rightThread,
        mode,
        data,
      });
      const tier = getDerivedConnectionTier(strength);

      if (!tier) {
        continue;
      }

      const [sourceId, targetId] = [leftThread.id, rightThread.id].sort((leftId, rightId) =>
        leftId.localeCompare(rightId),
      );

      derivedEdges.push({
        id: `derived-${sourceId}-${targetId}`,
        sourceId,
        targetId,
        strength,
        tier,
        reasons,
        visibleInMode: mode,
        visible: false,
        sourceVisible: false,
        targetVisible: false,
      });
    }
  }

  return derivedEdges;
}

function buildVisibleThreadIds(
  threads: BoardThread[],
  _mode: BoardMode,
  selectedNodeId: string | null,
  focusedPatternId: string | null,
): Set<string> {
  const visibleIds = new Set<string>();

  for (const thread of threads) {
    if (thread.state === 'active' || thread.state === 'escalated') {
      visibleIds.add(thread.id);
    }
  }

  if (selectedNodeId) {
    const selectedThread = threads.find((thread) => thread.id === selectedNodeId);
    if (selectedThread) {
      visibleIds.add(selectedThread.id);
    }

    const selectedPatternThreads = threads.filter(
      (thread) => thread.patternId === selectedNodeId,
    );
    for (const thread of selectedPatternThreads) {
      visibleIds.add(thread.id);
    }
  }

  if (focusedPatternId) {
    const focusedPatternThreads = threads.filter(
      (thread) => thread.patternId === focusedPatternId,
    );
    for (const thread of focusedPatternThreads) {
      visibleIds.add(thread.id);
    }
  }

  return visibleIds;
}

function buildVisiblePatternIds(
  patterns: BoardPattern[],
  threads: BoardThread[],
  _mode: BoardMode,
  visibleThreadIds: Set<string>,
  selectedNodeId: string | null,
  focusedPatternId: string | null,
  manualLinks: BoardManualLink[],
): Set<string> {
  const visiblePatternIds = new Set<string>();
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const alwaysVisibleNodeIds = new Set<string>(['now', ...visibleThreadIds]);

  for (const pattern of patterns) {
    const roleVisibleThreads = threads.filter(
      (thread) => thread.patternId === pattern.id,
    );
    const hasPressureThread = roleVisibleThreads.some(
      (thread) => thread.state === 'active' || thread.state === 'escalated',
    );
    const containsVisibleThread = roleVisibleThreads.some((thread) => visibleThreadIds.has(thread.id));
    const isFocusedPattern = pattern.id === focusedPatternId || pattern.id === selectedNodeId;

    if (hasPressureThread || containsVisibleThread || isFocusedPattern) {
      visiblePatternIds.add(pattern.id);
    }
  }

  let nextPatternBecameVisible = true;
  while (nextPatternBecameVisible) {
    nextPatternBecameVisible = false;

    for (const link of manualLinks) {
      const linkTouchesPattern =
        patternIds.has(link.sourceId) || patternIds.has(link.targetId);

      if (!linkTouchesPattern) {
        continue;
      }

      const sourceVisible = alwaysVisibleNodeIds.has(link.sourceId) || visiblePatternIds.has(link.sourceId);
      const targetVisible = alwaysVisibleNodeIds.has(link.targetId) || visiblePatternIds.has(link.targetId);

      if (!sourceVisible && !targetVisible) {
        continue;
      }

      if (patternIds.has(link.sourceId) && !visiblePatternIds.has(link.sourceId)) {
        visiblePatternIds.add(link.sourceId);
        nextPatternBecameVisible = true;
      }

      if (patternIds.has(link.targetId) && !visiblePatternIds.has(link.targetId)) {
        visiblePatternIds.add(link.targetId);
        nextPatternBecameVisible = true;
      }
    }
  }

  return visiblePatternIds;
}

function buildThreadLayoutClusterAssignments(
  threads: BoardThread[],
  visibleThreadIds: Set<string>,
  visiblePatternIds: Set<string>,
  derivedEdges: DerivedThreatEdge[],
): Map<string, string> {
  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const assignments = new Map<string, string>();

  for (const thread of threads) {
    if (!visibleThreadIds.has(thread.id) || !thread.patternId || !visiblePatternIds.has(thread.patternId)) {
      continue;
    }

    assignments.set(thread.id, thread.patternId);
  }

  for (const thread of threads) {
    if (!visibleThreadIds.has(thread.id) || assignments.has(thread.id)) {
      continue;
    }

    const patternScores = new Map<string, number>();

    for (const edge of derivedEdges) {
      if (edge.sourceId !== thread.id && edge.targetId !== thread.id) {
        continue;
      }

      const relatedThreadId = edge.sourceId === thread.id ? edge.targetId : edge.sourceId;
      const relatedThread = threadById.get(relatedThreadId);

      if (!relatedThread?.patternId || !visiblePatternIds.has(relatedThread.patternId)) {
        continue;
      }

      patternScores.set(
        relatedThread.patternId,
        (patternScores.get(relatedThread.patternId) ?? 0) + edge.strength,
      );
    }

    const strongestPattern = [...patternScores.entries()].sort(
      ([leftPatternId, leftScore], [rightPatternId, rightScore]) =>
        rightScore - leftScore || leftPatternId.localeCompare(rightPatternId),
    )[0];

    if (strongestPattern) {
      assignments.set(thread.id, strongestPattern[0]);
    }
  }

  return assignments;
}

function toPatternPosition(index: number, count: number, radiusX: number, radiusY: number) {
  if (count === 1) {
    return {
      angle: -Math.PI / 2,
      x: 0,
      y: -radiusY,
    };
  }

  const angle = (-Math.PI / 2) + (index * ((Math.PI * 2) / Math.max(count, 1)));
  return {
    angle,
    x: Math.cos(angle) * radiusX,
    y: Math.sin(angle) * radiusY,
  };
}

function toClusterThreadPosition(
  patternAngle: number,
  patternX: number,
  patternY: number,
  threadIndex: number,
  threadCount: number,
  ringRadius: number,
) {
  if (threadCount === 1) {
    return {
      x: patternX + Math.cos(patternAngle) * ringRadius,
      y: patternY + Math.sin(patternAngle) * ringRadius,
    };
  }

  const startAngle = patternAngle - Math.PI / 2;
  const angle = startAngle + (Math.PI * 2 * threadIndex) / threadCount;
  return {
    x: patternX + Math.cos(angle) * ringRadius,
    y: patternY + Math.sin(angle) * ringRadius,
  };
}

function getClusterRingRadius(threadCount: number, patternDiameter = PATTERN_NODE_DIAMETER) {
  const spacing = THREAD_NODE_DIAMETER + NOTE_GAP + NOTE_HOVER_DIAMETER_BOOST;
  const minimumFromPattern =
    patternDiameter / 2 +
    THREAD_NODE_DIAMETER / 2 +
    NOTE_GAP +
    NOTE_HOVER_DIAMETER_BOOST / 2 +
    8;

  if (threadCount <= 1) {
    return minimumFromPattern;
  }

  const minimumFromCount = spacing / (2 * Math.sin(Math.PI / threadCount));
  return Math.max(minimumFromPattern, minimumFromCount);
}

function buildSoloThreadPositions(threadCount: number, baseRadius: number) {
  if (threadCount === 0) {
    return [];
  }

  const positions: Array<{ x: number; y: number }> = [];
  const spacing = THREAD_NODE_DIAMETER + NOTE_GAP + NOTE_HOVER_DIAMETER_BOOST;
  let placedCount = 0;
  let ringIndex = 0;

  while (placedCount < threadCount) {
    const remainingCount = threadCount - placedCount;
    const minimumRadiusForRemaining =
      remainingCount === 1 ? spacing : spacing / (2 * Math.sin(Math.PI / remainingCount));
    const ringRadius = Math.max(baseRadius + ringIndex * spacing, minimumRadiusForRemaining);
    const ringCapacity = Math.max(1, Math.floor((Math.PI * 2 * ringRadius) / spacing));
    const countOnRing = Math.min(remainingCount, ringCapacity);
    const angleOffset = Math.PI / 2 + ringIndex * 0.35;

    for (let ringNodeIndex = 0; ringNodeIndex < countOnRing; ringNodeIndex += 1) {
      const angle = angleOffset + (Math.PI * 2 * ringNodeIndex) / countOnRing;
      positions.push({
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
      });
    }

    placedCount += countOnRing;
    ringIndex += 1;
  }

  return positions;
}

function buildManualGraphEdges(
  manualLinks: BoardManualLink[],
  visibleNodeIds: Set<string>,
  canonicalEdges: BoardGraphEdge[],
  accessibleNodeIds: Set<string>,
) {
  const canonicalPairKeys = new Set(
    canonicalEdges.map((edge) => toNodePairKey(edge.source, edge.target)),
  );
  const seenManualPairs = new Set<string>();
  const manualEdges: BoardGraphEdge[] = [];

  for (const link of manualLinks) {
    if (link.sourceId === link.targetId) {
      continue;
    }

    const pairKey = toNodePairKey(link.sourceId, link.targetId);

    if (seenManualPairs.has(pairKey) || canonicalPairKeys.has(pairKey)) {
      continue;
    }

    seenManualPairs.add(pairKey);

    manualEdges.push({
      id: link.id,
      source: link.sourceId,
      target: link.targetId,
      kind: 'relates',
      connectionClass: 'manual',
      visible: visibleNodeIds.has(link.sourceId) && visibleNodeIds.has(link.targetId),
      emphasized: false,
      dimmed: false,
      accessibleInPerspective:
        accessibleNodeIds.has(link.sourceId) && accessibleNodeIds.has(link.targetId),
    });
  }

  return manualEdges;
}

function buildAdjacency(edges: BoardGraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!edge.visible) {
      continue;
    }

    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set<string>());
    }
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set<string>());
    }

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  return adjacency;
}

function getPatternOrbitRadii(
  visiblePatternCount: number,
  clusterRingRadii: Map<string, number>,
  visiblePatternIds: string[],
  patternNodeSizes: Map<string, number>,
  centerNodeDiameter: number,
) {
  const patternOuterRadii = visiblePatternIds.map(
    (patternId) =>
      (clusterRingRadii.get(patternId) ?? 0) +
      (patternNodeSizes.get(patternId) ?? PATTERN_NODE_DIAMETER) / 2 +
      THREAD_NODE_DIAMETER / 2 +
      NOTE_GAP,
  );
  const maxPatternOuterRadius = patternOuterRadii.length > 0 ? Math.max(...patternOuterRadii) : 0;
  const minimumRadiusFromCenter = centerNodeDiameter / 2 + maxPatternOuterRadius + 56;
  const minimumCenterToCenterDistance = maxPatternOuterRadius * 2 + 72;
  const requiredCircleRadius =
    visiblePatternCount <= 1
      ? minimumRadiusFromCenter
      : minimumCenterToCenterDistance / (2 * Math.sin(Math.PI / visiblePatternCount));
  const orbitRadiusX = Math.max(PATTERN_RING_X, minimumRadiusFromCenter, requiredCircleRadius);
  const orbitRadiusY = Math.max(PATTERN_RING_Y, orbitRadiusX * 0.76);

  return {
    orbitRadiusX,
    orbitRadiusY,
  };
}

function buildConnectionFocusThreadIds(
  visibleThreadIds: Set<string>,
  threads: BoardThread[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  focusedPatternId: string | null,
): Set<string> {
  const focusThreadIds = new Set<string>();

  if (hoveredNodeId && visibleThreadIds.has(hoveredNodeId)) {
    focusThreadIds.add(hoveredNodeId);
    return focusThreadIds;
  }

  if (selectedNodeId && visibleThreadIds.has(selectedNodeId)) {
    focusThreadIds.add(selectedNodeId);
    return focusThreadIds;
  }

  if (focusedPatternId) {
    for (const thread of threads) {
      if (thread.patternId === focusedPatternId && visibleThreadIds.has(thread.id)) {
        focusThreadIds.add(thread.id);
      }
    }
  }

  return focusThreadIds;
}

export function buildBoardGraph({
  data,
  mode,
  selectedNodeId,
  hoveredNodeId,
  focusedPatternId,
  centerNodeId = null,
  manualLinks = [],
  derivedData = data,
  perspectiveAccess = null,
  showInaccessibleContext = false,
}: BuildBoardGraphOptions): BoardGraphResult {
  const graphThreads = data.threads.filter((thread) => !isStagedThread(thread));
  const graphPatterns = data.patterns.filter((pattern) => !isStagedPattern(pattern));
  const derivedGraphThreads = derivedData.threads.filter((thread) => !isStagedThread(thread));
  const derivedGraphPatterns = derivedData.patterns.filter((pattern) => !isStagedPattern(pattern));
  const sanitizedDerivedData: ProjectBoardData = {
    ...derivedData,
    threads: derivedGraphThreads,
    patterns: derivedGraphPatterns,
  };
  const nowNodeDiameter = mode === 'player' ? PATTERN_NODE_DIAMETER : NOW_NODE_DIAMETER;
  const playerAnchorPatternIds = new Set(graphPatterns.map((pattern) => pattern.id).filter((patternId) =>
    data.playerProfiles.some((profile) => profile.patternId === patternId),
  ));
  const accessibleThreadIds =
    perspectiveAccess?.accessibleThreadIds ??
    new Set(derivedGraphThreads.map((thread) => thread.id));
  const accessiblePatternIds =
    perspectiveAccess?.accessiblePatternIds ??
    new Set(derivedGraphPatterns.map((pattern) => pattern.id));
  const visibleThreadIds = buildVisibleThreadIds(derivedGraphThreads, mode, selectedNodeId, focusedPatternId);
  const visiblePatternIds = buildVisiblePatternIds(
    derivedGraphPatterns,
    derivedGraphThreads,
    mode,
    visibleThreadIds,
    selectedNodeId,
    focusedPatternId,
    manualLinks,
  );

  const renderedThreadIds = new Set(visibleThreadIds);
  const renderedPatternIds = new Set(visiblePatternIds);

  if (showInaccessibleContext) {
    for (const thread of graphThreads) {
      if (!accessibleThreadIds.has(thread.id)) {
        renderedThreadIds.add(thread.id);
      }
    }

    for (const pattern of graphPatterns) {
      if (!accessiblePatternIds.has(pattern.id)) {
        renderedPatternIds.add(pattern.id);
      }
    }
  }

  const derivedEdges = buildDerivedThreatEdges({
    data: sanitizedDerivedData,
    mode: mode === 'player' && perspectiveAccess ? 'gm' : mode,
  });
  const threadLayoutClusterAssignments = buildThreadLayoutClusterAssignments(
    graphThreads,
    renderedThreadIds,
    renderedPatternIds,
    derivedEdges,
  );
  const threadHubScores = new Map<string, number>();
  const threadStrongConnectionCounts = new Map<string, number>();

  for (const thread of graphThreads.filter((entry) => renderedThreadIds.has(entry.id))) {
    threadHubScores.set(thread.id, 0);
    threadStrongConnectionCounts.set(thread.id, 0);
  }

  for (const edge of derivedEdges) {
    threadHubScores.set(edge.sourceId, (threadHubScores.get(edge.sourceId) ?? 0) + edge.strength);
    threadHubScores.set(edge.targetId, (threadHubScores.get(edge.targetId) ?? 0) + edge.strength);

    if (edge.tier === 'strong') {
      threadStrongConnectionCounts.set(edge.sourceId, (threadStrongConnectionCounts.get(edge.sourceId) ?? 0) + 1);
      threadStrongConnectionCounts.set(edge.targetId, (threadStrongConnectionCounts.get(edge.targetId) ?? 0) + 1);
    }
  }

  const visibleThreadSet = new Set(visibleThreadIds);
  const patternHubScores = new Map<string, number>();
  for (const pattern of graphPatterns) {
    const visibleChildThreadIds = new Set(pattern.threadIds.filter((threadId) => visibleThreadSet.has(threadId)));
    let hubScore = 0;

    for (const edge of derivedEdges) {
      const touchesVisibleChild =
        visibleChildThreadIds.has(edge.sourceId) || visibleChildThreadIds.has(edge.targetId);
      const otherEndpointVisible =
        visibleThreadSet.has(edge.sourceId) && visibleThreadSet.has(edge.targetId);

      if (touchesVisibleChild && otherEndpointVisible) {
        hubScore += edge.strength;
      }
    }

    patternHubScores.set(pattern.id, roundStrength(hubScore));
  }

  const clusterThreads = new Map<string, BoardThread[]>();
  const clusterRingRadii = new Map<string, number>();
  const soloThreads: BoardThread[] = [];
  const patternNodeSizes = new Map<string, number>(
    graphPatterns.map((pattern) => [
      pattern.id,
      mode === 'player' && pattern.id === centerNodeId ? NOW_NODE_DIAMETER : PATTERN_NODE_DIAMETER,
    ]),
  );

  for (const thread of graphThreads) {
    if (!visibleThreadIds.has(thread.id)) {
      continue;
    }

    const layoutClusterId = threadLayoutClusterAssignments.get(thread.id);

    if (layoutClusterId && visiblePatternIds.has(layoutClusterId)) {
      if (!clusterThreads.has(layoutClusterId)) {
        clusterThreads.set(layoutClusterId, []);
      }
      clusterThreads.get(layoutClusterId)?.push(thread);
      continue;
    }

    soloThreads.push(thread);
  }

  for (const [patternId, threads] of clusterThreads.entries()) {
    clusterRingRadii.set(patternId, getClusterRingRadius(threads.length, patternNodeSizes.get(patternId)));
  }

  const nodes: BoardGraphNode[] = [
    {
      id: data.now.id,
      type: 'now',
      label: 'NOW',
      position: { x: 0, y: 0 },
      size: nowNodeDiameter,
      visible: true,
      emphasized: false,
      dimmed: false,
      playerVisible: true,
      accessibleInPerspective: true,
      tone: 'now',
      isPlayerAnchor: false,
      isCenteredPlayerAnchor: false,
      hubScore: 0,
      strongConnectionCount: 0,
      connectionIds: [],
    },
  ];

  const canonicalEdges: BoardGraphEdge[] = [];
  const visiblePatterns = sortByTitle(
    graphPatterns.filter((pattern) => renderedPatternIds.has(pattern.id)),
  );
  const { orbitRadiusX, orbitRadiusY } = getPatternOrbitRadii(
    visiblePatterns.length,
    clusterRingRadii,
    visiblePatterns.map((pattern) => pattern.id),
    patternNodeSizes,
    nowNodeDiameter,
  );
  const visiblePatternPositions = new Map<string, { x: number; y: number; angle: number }>();

  for (const [index, pattern] of visiblePatterns.entries()) {
    const position = toPatternPosition(index, visiblePatterns.length, orbitRadiusX, orbitRadiusY);
    const patternSize = patternNodeSizes.get(pattern.id) ?? PATTERN_NODE_DIAMETER;
    visiblePatternPositions.set(pattern.id, position);
    nodes.push({
      id: pattern.id,
      type: 'pattern',
      label: pattern.title,
      position: { x: position.x, y: position.y },
      size: patternSize,
      visible: true,
      emphasized: false,
      dimmed: false,
      playerVisible: pattern.playerVisible,
      accessibleInPerspective: accessiblePatternIds.has(pattern.id),
      tone: 'pattern',
      isPlayerAnchor: playerAnchorPatternIds.has(pattern.id),
      isCenteredPlayerAnchor: mode === 'player' && pattern.id === centerNodeId,
      hubScore: patternHubScores.get(pattern.id) ?? 0,
      strongConnectionCount: 0,
      connectionIds: [],
    });
    canonicalEdges.push({
      id: `edge-now-${pattern.id}`,
      source: data.now.id,
      target: pattern.id,
      kind: 'relates',
      connectionClass: 'canonical',
      visible: true,
      emphasized: false,
      dimmed: false,
      accessibleInPerspective: accessiblePatternIds.has(pattern.id),
    });
  }

  for (const [patternId, threads] of clusterThreads.entries()) {
    const sortedThreads = sortByTitle(threads);
    const patternPosition = visiblePatternPositions.get(patternId);
    const ringRadius =
      clusterRingRadii.get(patternId) ?? getClusterRingRadius(sortedThreads.length, patternNodeSizes.get(patternId));

    if (!patternPosition) {
      continue;
    }

    for (const [index, thread] of sortedThreads.entries()) {
      const position = toClusterThreadPosition(
        patternPosition.angle,
        patternPosition.x,
        patternPosition.y,
        index,
        sortedThreads.length,
        ringRadius,
      );

      nodes.push({
        id: thread.id,
        type: 'thread',
        label: thread.title,
        state: thread.state,
        timelineAnchor: thread.timelineAnchor,
        position,
        size: THREAD_NODE_DIAMETER,
        visible: true,
        emphasized: false,
        dimmed: false,
        playerVisible: thread.playerVisible,
        accessibleInPerspective: accessibleThreadIds.has(thread.id),
        tone: THREAD_STATE_META[thread.state].tone,
        isPlayerAnchor: false,
        isCenteredPlayerAnchor: false,
        hubScore: roundStrength(threadHubScores.get(thread.id) ?? 0),
        strongConnectionCount: threadStrongConnectionCounts.get(thread.id) ?? 0,
        connectionIds: [],
      });
      canonicalEdges.push({
        id: `edge-${patternId}-${thread.id}`,
        source: patternId,
        target: thread.id,
        kind: 'contains',
        connectionClass: 'canonical',
        visible: true,
        emphasized: false,
        dimmed: false,
        accessibleInPerspective:
          accessiblePatternIds.has(patternId) && accessibleThreadIds.has(thread.id),
      });
    }
  }

  const sortedSoloThreads = sortByTitle(soloThreads);
  const patternOrbitExtent =
    visiblePatterns.length > 0
      ? Math.max(
          ...visiblePatterns.map((pattern) => {
            const patternPosition = visiblePatternPositions.get(pattern.id);
            const clusterRadius = clusterRingRadii.get(pattern.id) ?? 0;
            const centerDistance = patternPosition
              ? Math.hypot(patternPosition.x, patternPosition.y)
              : 0;

            return centerDistance + (patternNodeSizes.get(pattern.id) ?? PATTERN_NODE_DIAMETER) / 2 + clusterRadius + NOTE_GAP;
          }),
        )
      : 0;
  const soloThreadBaseRadius = Math.max(
    240,
    patternOrbitExtent + THREAD_NODE_DIAMETER / 2 + NOTE_HOVER_DIAMETER_BOOST / 2 + 32,
  );
  const soloThreadPositions = buildSoloThreadPositions(sortedSoloThreads.length, soloThreadBaseRadius);

  for (const [index, thread] of sortedSoloThreads.entries()) {
    nodes.push({
      id: thread.id,
      type: 'thread',
      label: thread.title,
      state: thread.state,
      timelineAnchor: thread.timelineAnchor,
      position: soloThreadPositions[index] ?? { x: 0, y: soloThreadBaseRadius },
      size: THREAD_NODE_DIAMETER,
      visible: true,
      emphasized: false,
      dimmed: false,
      playerVisible: thread.playerVisible,
      accessibleInPerspective: accessibleThreadIds.has(thread.id),
      tone: THREAD_STATE_META[thread.state].tone,
      isPlayerAnchor: false,
      isCenteredPlayerAnchor: false,
      hubScore: roundStrength(threadHubScores.get(thread.id) ?? 0),
      strongConnectionCount: threadStrongConnectionCounts.get(thread.id) ?? 0,
      connectionIds: [],
    });
    canonicalEdges.push({
      id: `edge-now-${thread.id}`,
      source: data.now.id,
      target: thread.id,
      kind: 'relates',
      connectionClass: 'canonical',
      visible: true,
      emphasized: false,
      dimmed: false,
      accessibleInPerspective: accessibleThreadIds.has(thread.id),
    });
  }

  const connectionFocusThreadIds = buildConnectionFocusThreadIds(
    visibleThreadIds,
    graphThreads,
    hoveredNodeId,
    selectedNodeId,
    focusedPatternId,
  );

  const renderedDerivedEdges: BoardGraphEdge[] = derivedEdges.map((edge) => {
    const sourceVisible = visibleThreadIds.has(edge.sourceId);
    const targetVisible = visibleThreadIds.has(edge.targetId);
    const touchesFocusedThread =
      connectionFocusThreadIds.size > 0 &&
      (connectionFocusThreadIds.has(edge.sourceId) || connectionFocusThreadIds.has(edge.targetId));
    const visible =
      sourceVisible &&
      targetVisible &&
      touchesFocusedThread &&
      (edge.tier === 'strong' || edge.tier === 'medium');

    edge.sourceVisible = sourceVisible;
    edge.targetVisible = targetVisible;
    edge.visible = visible;

    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      kind: 'relates',
      connectionClass: 'derived',
      tier: edge.tier,
      strength: edge.strength,
      visible,
      emphasized: false,
      dimmed: false,
      accessibleInPerspective:
        accessibleThreadIds.has(edge.sourceId) && accessibleThreadIds.has(edge.targetId),
    };
  });

  const visibleNodeIds = new Set(nodes.filter((node) => node.visible).map((node) => node.id));
  const accessibleNodeIds = new Set([
    data.now.id,
    ...accessiblePatternIds,
    ...accessibleThreadIds,
  ]);
  const manualEdges = buildManualGraphEdges(manualLinks, visibleNodeIds, canonicalEdges, accessibleNodeIds);
  const edges = [...canonicalEdges, ...manualEdges, ...renderedDerivedEdges];
  const adjacency = buildAdjacency(edges);
  const emphasisIds = new Set<string>();
  const focusId = hoveredNodeId ?? selectedNodeId ?? focusedPatternId ?? data.now.id;

  if (focusId) {
    emphasisIds.add(focusId);
    adjacency.get(focusId)?.forEach((connectionId) => emphasisIds.add(connectionId));
  }

  if (focusedPatternId) {
    emphasisIds.add(focusedPatternId);
    adjacency.get(focusedPatternId)?.forEach((connectionId) => emphasisIds.add(connectionId));
  }

  const shouldDimUnrelated = Boolean(hoveredNodeId);

  for (const node of nodes) {
    const nodeConnections = adjacency.get(node.id) ?? new Set<string>();
    node.connectionIds = [...nodeConnections].sort();
    node.emphasized = emphasisIds.has(node.id);
    node.dimmed = shouldDimUnrelated && !node.emphasized;
  }

  for (const edge of edges) {
    const isFocusedEdge =
      emphasisIds.has(edge.source) &&
      emphasisIds.has(edge.target);
    edge.emphasized = isFocusedEdge;
    edge.dimmed = shouldDimUnrelated && !isFocusedEdge;
  }

  return {
    nodes,
    edges,
    canonicalEdges,
    manualEdges,
    derivedEdges,
  };
}

export function summarizeTimelineAnchors(data: ProjectBoardData, mode: BoardMode): Record<'past' | 'now' | 'future', number> {
  const summary = {
    past: 0,
    now: 0,
    future: 0,
  };

  for (const thread of data.threads) {
    if (isStagedThread(thread) || !isVisibleToMode(thread.playerVisible, mode)) {
      continue;
    }

    if (thread.timelineAnchor === 'future_possible') {
      summary.future += 1;
      continue;
    }

    summary[thread.timelineAnchor] += 1;
  }

  return summary;
}
