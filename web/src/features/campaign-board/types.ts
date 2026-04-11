import type { DomainThreadState } from '@/lib/thread-state';

export type BoardMode = 'gm' | 'player';
export type BoardTimelineAnchor = 'past' | 'now' | 'future_possible';
export type BoardLinkedEntityType = 'character' | 'event' | 'npc' | 'item' | 'location' | 'thread';
export type BoardGraphEdgeKind = 'contains' | 'relates' | 'timeline';
export type BoardNodeTone = 'now' | 'pattern' | 'dormant' | 'active' | 'escalated' | 'resolved';
export type DerivedConnectionTier = 'strong' | 'medium' | 'weak';
export type DerivedConnectionReasonKind = 'shared_entity' | 'timeline' | 'state' | 'pattern';
export type BoardStaging = {
  isStaged: boolean;
  trayAnchor: BoardTimelineAnchor;
};

export type BoardLinkedEntity = {
  id: string;
  type: BoardLinkedEntityType;
  name: string;
  playerVisible: boolean;
};

export type BoardThread = {
  id: string;
  title: string;
  state: DomainThreadState;
  hook?: string;
  playerSummary: string;
  gmTruth?: string;
  timelineAnchor: BoardTimelineAnchor;
  linkedEntityIds: string[];
  patternId?: string;
  playerVisible: boolean;
  staging?: BoardStaging;
};

export type BoardPattern = {
  id: string;
  title: string;
  summary: string;
  escalationLevel: number;
  threadIds: string[];
  playerVisible: boolean;
  staging?: BoardStaging;
};

export type BoardStagedNote = {
  id: string;
  type: 'thread' | 'pattern';
  title: string;
  trayAnchor: BoardTimelineAnchor;
  state?: DomainThreadState;
};

export type BoardPlayerProfile = {
  userId: string;
  username: string;
  displayName: string;
  patternId: string;
  perspectivePatternIds?: string[];
  perspectiveThreadIds?: string[];
};

export type BoardPerspectiveAccess = {
  accessiblePatternIds: Set<string>;
  accessibleThreadIds: Set<string>;
  accessibleEntityIds: Set<string>;
};

export type BoardPerspectiveRevealOverrides = {
  globalNodeIds: string[];
  playerNodeIds: string[];
};

export type BoardSharingState = {
  globalNodeIds: string[];
  playerNodeIdsByPlayer: Record<string, string[]>;
};

export type BoardRevisionSummary = {
  id: string;
  commandKind: string;
  summary: string;
  createdAt: string;
};

export type BoardHistoryState = {
  totalRevisions: number;
  headIndex: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type ProjectBoardData = {
  project: {
    id: string;
    name: string;
    status: 'active' | 'paused';
  };
  now: {
    id: 'now';
    title: string;
    playerSummary: string;
    gmTruth?: string;
  };
  threads: BoardThread[];
  patterns: BoardPattern[];
  linkedEntities: Record<string, BoardLinkedEntity>;
  playerProfiles: BoardPlayerProfile[];
  manualLinks?: BoardManualLink[];
  sharing?: BoardSharingState;
  revision?: BoardRevisionSummary | null;
  history?: BoardHistoryState;
};

export type BoardProjectOption = {
  id: string;
  name: string;
};

export type BoardGraphNodeType = 'now' | 'thread' | 'pattern';

export type BoardManualLink = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type BoardGraphNode = {
  id: string;
  type: BoardGraphNodeType;
  label: string;
  state?: DomainThreadState;
  timelineAnchor?: BoardTimelineAnchor;
  position: {
    x: number;
    y: number;
  };
  size: number;
  visible: boolean;
  emphasized: boolean;
  dimmed: boolean;
  playerVisible: boolean;
  accessibleInPerspective: boolean;
  tone: BoardNodeTone;
  isPlayerAnchor: boolean;
  isCenteredPlayerAnchor: boolean;
  hubScore: number;
  strongConnectionCount: number;
  connectionIds: string[];
};

export type BoardGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: BoardGraphEdgeKind;
  connectionClass: 'canonical' | 'derived' | 'manual';
  tier?: DerivedConnectionTier;
  strength?: number;
  visible: boolean;
  emphasized: boolean;
  dimmed: boolean;
  accessibleInPerspective: boolean;
};

export type DerivedConnectionReason = {
  kind: DerivedConnectionReasonKind;
  label: string;
  weight: number;
};

export type DerivedThreatEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
  tier: DerivedConnectionTier;
  reasons: DerivedConnectionReason[];
  visibleInMode: BoardMode;
  visible: boolean;
  sourceVisible: boolean;
  targetVisible: boolean;
};

export type BoardGraphResult = {
  nodes: BoardGraphNode[];
  edges: BoardGraphEdge[];
  canonicalEdges: BoardGraphEdge[];
  manualEdges: BoardGraphEdge[];
  derivedEdges: DerivedThreatEdge[];
};

export const BOARD_TIMELINE_LABELS: Record<BoardTimelineAnchor, string> = {
  past: 'Past',
  now: 'Now',
  future_possible: 'Future',
};

export const THREAD_STATE_META: Record<
  DomainThreadState,
  { label: string; tone: Exclude<BoardNodeTone, 'now' | 'pattern'>; accent: string }
> = {
  dormant: { label: 'Dormant', tone: 'dormant', accent: '#4c88cf' },
  active: { label: 'Active', tone: 'active', accent: '#66d7ff' },
  escalated: { label: 'Escalated', tone: 'escalated', accent: '#ffae53' },
  resolved: { label: 'Resolved', tone: 'resolved', accent: '#92a0ba' },
};

export function getBoardTimelineLabel(anchor: BoardTimelineAnchor): string {
  return BOARD_TIMELINE_LABELS[anchor];
}
