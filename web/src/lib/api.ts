import { DomainThreadState } from '@/lib/thread-state';
import { toApiRole } from '@/lib/roles';

export type ThreadSummary = {
  id: string;
  title: string;
  state: DomainThreadState;
  updatedAt?: string;
};

export type ThreadDetail = ThreadSummary & {
  player_summary?: string;
  gm_truth?: string;
  messages?: Array<{
    id: string;
    author: string;
    text: string;
    createdAt?: string;
  }>;
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  role: string;
};

export type AuthenticatedRequestContext = {
  role: string;
  userId?: string;
};

export const LOGIN_ERROR_INVALID_CREDENTIALS = 'LOGIN_ERROR_INVALID_CREDENTIALS';
export const LOGIN_ERROR_REQUEST_FAILED = 'LOGIN_ERROR_REQUEST_FAILED';

type LoginResponse =
  | { user: AuthenticatedUser }
  | {
      user_id?: string;
      id?: string;
      username?: string;
      role?: string;
    };

export type TimelineEvent = {
  id: string;
  type: string;
  label: string;
  occurredAt?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
};

export type SelectedProjectPreference = {
  project_id: string | null;
};

export type ProjectGraphView = 'gm' | 'player';

export type ProjectGraphLinkedEntity = {
  id: string;
  type: 'character' | 'event' | 'npc' | 'item' | 'location' | 'thread';
  name: string;
  playerVisible: boolean;
};

export type ProjectGraphPlayerProfile = {
  userId: string;
  username: string;
  displayName: string;
  patternId: string;
  perspectivePatternIds?: string[];
  perspectiveThreadIds?: string[];
};

export type StagingMetadata = {
  isStaged: boolean;
  trayAnchor: 'past' | 'now' | 'future_possible';
};

export type ManualLink = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type ProjectSharingState = {
  globalNodeIds: string[];
  playerNodeIdsByPlayer: Record<string, string[]>;
};

export type RevisionSummary = {
  id: string;
  commandKind: string;
  summary: string;
  createdAt: string;
};

export type ProjectHistoryState = {
  totalRevisions: number;
  headIndex: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type ProjectGraphResponse = {
  project: {
    id: string;
    name: string;
    status: string;
  };
  now: {
    id: string;
    title: string;
    playerSummary: string;
    gmTruth?: string;
  };
  threads: Array<{
    id: string;
    title: string;
    state: DomainThreadState;
    hook?: string;
    playerSummary: string;
    gmTruth?: string;
    timelineAnchor: 'past' | 'now' | 'future_possible';
    linkedEntityIds: string[];
    patternId?: string;
    playerVisible: boolean;
    staging?: StagingMetadata;
  }>;
  patterns: Array<{
    id: string;
    title: string;
    summary: string;
    escalationLevel: number;
    threadIds: string[];
    playerVisible: boolean;
    staging?: StagingMetadata;
  }>;
  linkedEntities: Record<string, ProjectGraphLinkedEntity>;
  playerProfiles: ProjectGraphPlayerProfile[];
  manualLinks: ManualLink[];
  sharing: ProjectSharingState;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind: 'contains' | 'relates' | 'timeline';
  }>;
  timelineSummary: {
    past: number;
    now: number;
    future: number;
  };
  mode: ProjectGraphView;
  revision: RevisionSummary | null;
  history: ProjectHistoryState;
};

export type ProjectCommand =
  | {
      kind: 'update_thread';
      threadId: string;
      title?: string;
      hook?: string | null;
      playerSummary?: string;
      gmTruth?: string | null;
      state?: DomainThreadState;
      timelineAnchor?: 'past' | 'now' | 'future_possible';
      linkedEntityIds?: string[];
      patternId?: string | null;
      playerVisible?: boolean;
    }
  | {
      kind: 'update_pattern';
      patternId: string;
      title?: string;
      summary?: string;
      escalationLevel?: number;
      playerVisible?: boolean;
    }
  | {
      kind: 'update_now';
      title?: string;
      playerSummary?: string;
      gmTruth?: string | null;
    }
  | {
      kind: 'create_thread';
      title: string;
      trayAnchor: 'past' | 'now' | 'future_possible';
      hook?: string | null;
      playerSummary?: string;
      gmTruth?: string | null;
    }
  | {
      kind: 'create_pattern';
      title: string;
      trayAnchor: 'past' | 'now' | 'future_possible';
      summary?: string;
      escalationLevel?: number;
    }
  | {
      kind: 'activate_staged_note';
      noteId: string;
      targetNodeId: string;
    }
  | {
      kind: 'create_manual_link';
      sourceId: string;
      targetId: string;
    }
  | {
      kind: 'delete_manual_link';
      linkId: string;
    }
  | {
      kind: 'share_node_to_player';
      nodeId: string;
      playerUserId: string;
    }
  | {
      kind: 'share_node_to_all';
      nodeId: string;
    }
  | {
      kind: 'unshare_node_from_player';
      nodeId: string;
      playerUserId: string;
    }
  | {
      kind: 'unshare_node_from_all';
      nodeId: string;
    };

export type CommandResponse = {
  revision: RevisionSummary;
  graph: ProjectGraphResponse;
};

export type ProjectHistoryResponse = {
  revisions: Array<
    RevisionSummary & {
      actorUserId: string;
      actorRole: string;
    }
  >;
  headIndex: number;
  canUndo: boolean;
  canRedo: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

function normalizeAuthenticatedUser(response: LoginResponse): AuthenticatedUser {
  if ('user' in response) {
    return response.user;
  }

  const id = typeof response.id === 'string' ? response.id : response.user_id;
  if (typeof id !== 'string' || typeof response.username !== 'string' || typeof response.role !== 'string') {
    throw new Error('Login response payload is invalid.');
  }

  return {
    id,
    username: response.username,
    role: response.role
  };
}

export function normalizeRoleForRequest(role: string): string {
  return toApiRole(role);
}

function createAuthenticatedHeaders(auth: AuthenticatedRequestContext): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-role': auth.role
  };

  if (auth.userId && auth.userId.trim().length > 0) {
    headers['x-user-id'] = auth.userId.trim();
  }

  return headers;
}

async function apiRequest<T>(path: string, auth: AuthenticatedRequestContext): Promise<T> {
  const headers = createAuthenticatedHeaders(auth);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

async function apiWriteRequest<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  auth: AuthenticatedRequestContext,
): Promise<T> {
  const headers = createAuthenticatedHeaders(auth);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHealth: (auth: AuthenticatedRequestContext) => apiRequest<{ status: string }>('/health', auth),
  getProjects: (auth: AuthenticatedRequestContext) => apiRequest<ProjectSummary[]>('/projects', auth),
  getPreferredProject: (auth: AuthenticatedRequestContext) =>
    apiRequest<SelectedProjectPreference>('/preferences/selected-project', auth),
  savePreferredProject: (projectId: string, auth: AuthenticatedRequestContext) =>
    apiWriteRequest<SelectedProjectPreference>(
      '/preferences/selected-project',
      'POST',
      { project_id: projectId },
      auth,
    ),
  getThreads: (auth: AuthenticatedRequestContext) => apiRequest<ThreadSummary[]>('/threads', auth),
  getThreadById: (id: string, auth: AuthenticatedRequestContext) => apiRequest<ThreadDetail>(`/threads/${id}`, auth),
  getTimelineEvents: (auth: AuthenticatedRequestContext) => apiRequest<TimelineEvent[]>('/timeline/events', auth),
  getProjectGraph: (id: string, view: ProjectGraphView, auth: AuthenticatedRequestContext, playerUserId?: string) =>
    apiRequest<ProjectGraphResponse>(
      `/projects/${id}/graph?view=${view}${playerUserId ? `&player_id=${encodeURIComponent(playerUserId)}` : ''}`,
      auth,
    ),
  runProjectCommand: (projectId: string, command: ProjectCommand, auth: AuthenticatedRequestContext) =>
    apiWriteRequest<CommandResponse>(`/projects/${projectId}/commands`, 'POST', command, auth),
  getProjectHistory: (projectId: string, auth: AuthenticatedRequestContext) =>
    apiRequest<ProjectHistoryResponse>(`/projects/${projectId}/history`, auth),
  undoProjectHistory: (projectId: string, auth: AuthenticatedRequestContext) =>
    apiWriteRequest<CommandResponse>(`/projects/${projectId}/history/undo`, 'POST', {}, auth),
  redoProjectHistory: (projectId: string, auth: AuthenticatedRequestContext) =>
    apiWriteRequest<CommandResponse>(`/projects/${projectId}/history/redo`, 'POST', {}, auth),
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      cache: 'no-store',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(LOGIN_ERROR_INVALID_CREDENTIALS);
      }

      throw new Error(`${LOGIN_ERROR_REQUEST_FAILED}:${response.status}`);
    }

    const payload = (await response.json()) as LoginResponse;
    return normalizeAuthenticatedUser(payload);
  }
};
