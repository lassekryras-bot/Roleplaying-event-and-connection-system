'use client';

import { useRole } from '@/contexts/role-context';
import { api } from '@/lib/api';
import { normalizeUsername } from '@/lib/auth';

export function useApiClient() {
  const { role, userId } = useRole();

  return {
    role,
    userId,
    getHealth: () => api.getHealth(role, userId),
    getThreads: () => api.getThreads(role, userId),
    getThreadById: (id: string) => api.getThreadById(id, role, userId),
    getTimelineEvents: () => api.getTimelineEvents(role, userId),
    login: (username: string, password: string) => api.login(normalizeUsername(username), password)
  };
}
