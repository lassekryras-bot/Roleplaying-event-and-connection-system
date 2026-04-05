import { DomainThreadState } from '@/lib/thread-state';

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

export type TimelineEvent = {
  id: string;
  type: string;
  label: string;
  occurredAt?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function apiRequest<T>(path: string, role: string, userId?: string): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-role': role
  };

  if (userId && userId.trim().length > 0) {
    headers['x-user-id'] = userId;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHealth: (role: string, userId?: string) => apiRequest<{ status: string }>('/health', role, userId),
  getThreads: (role: string, userId?: string) => apiRequest<ThreadSummary[]>('/threads', role, userId),
  getThreadById: (id: string, role: string, userId?: string) => apiRequest<ThreadDetail>(`/threads/${id}`, role, userId),
  getTimelineEvents: (role: string, userId?: string) => apiRequest<TimelineEvent[]>('/timeline/events', role, userId),
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
      throw new Error(`Login failed (${response.status})`);
    }

    return response.json() as Promise<{ user: AuthenticatedUser }>;
  }
};
