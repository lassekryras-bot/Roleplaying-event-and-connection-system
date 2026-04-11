import type {
  Hook,
  HookIndex,
  Place,
  PlaceIndex,
  Session,
  SessionIndex,
  ThreadIndex,
  ThreadRef,
  Timeline,
} from '@/generated/gm-timeline';
import type { GmTimelineDiagnostic } from '@/server/gm-timeline/errors';

export type GmTimelineProjectSummary = {
  id: string;
  name: string;
  status: string;
  hasTimelineContent: boolean;
};

export type GmTimelineBoardIndexes = {
  sessionIndex: SessionIndex | null;
  placeIndex: PlaceIndex | null;
  hookIndex: HookIndex | null;
  threadIndex: ThreadIndex | null;
};

export type GmTimelineBoardCounts = {
  filesLoaded: number;
  sessions: number;
  places: number;
  hooks: number;
  threadRefs: number;
  invalidFiles: number;
};

export type GmTimelineBoardPayload = {
  project: GmTimelineProjectSummary | null;
  projects: GmTimelineProjectSummary[];
  timeline: Timeline | null;
  sessions: Session[];
  places: Place[];
  hooks: Hook[];
  threadRefs: ThreadRef[];
  indexes: GmTimelineBoardIndexes;
  diagnostics: GmTimelineDiagnostic[];
  counts: GmTimelineBoardCounts;
  loadedAt: string;
};
