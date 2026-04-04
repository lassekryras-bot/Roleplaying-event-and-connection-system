export type ThreadSummary = {
  id: string;
  title: string;
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

export type TimelineEvent = {
  id: string;
  type: string;
  label: string;
  occurredAt?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function apiRequest<T>(path: string, role: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      'x-role': role
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHealth: (role: string) => apiRequest<{ status: string }>('/health', role),
  getThreads: (role: string) => apiRequest<ThreadSummary[]>('/threads', role),
  getThreadById: (id: string, role: string) => apiRequest<ThreadDetail>(`/threads/${id}`, role),
  getTimelineEvents: (role: string) => apiRequest<TimelineEvent[]>('/timeline/events', role)
};
