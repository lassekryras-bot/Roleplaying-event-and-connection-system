'use client';

import { useRole } from '@/contexts/role-context';
import { api } from '@/lib/api';

export function useApiClient() {
  const { role } = useRole();

  return {
    role,
    getHealth: () => api.getHealth(role),
    getThreads: () => api.getThreads(role),
    getThreadById: (id: string) => api.getThreadById(id, role),
    getTimelineEvents: () => api.getTimelineEvents(role)
  };
}
