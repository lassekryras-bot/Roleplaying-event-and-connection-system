'use client';

import { useMemo } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { api, normalizeRoleForRequest } from '@/lib/api';
import { normalizeUsername } from '@/lib/auth';

export function useApiClient() {
  const { role, userId } = useAuth();
  const authenticatedRequest = useMemo(
    () => ({
      role: normalizeRoleForRequest(role),
      userId,
    }),
    [role, userId],
  );

  return useMemo(
    () => ({
      role,
      userId,
      getHealth: () => api.getHealth(authenticatedRequest),
      getProjects: () => api.getProjects(authenticatedRequest),
      getPreferredProject: () => api.getPreferredProject(authenticatedRequest),
      savePreferredProject: (projectId: string) => api.savePreferredProject(projectId, authenticatedRequest),
      getProjectGraph: (id: string, view: 'gm' | 'player', playerUserId?: string) =>
        api.getProjectGraph(id, view, authenticatedRequest, playerUserId),
      runProjectCommand: (projectId: string, command: Parameters<typeof api.runProjectCommand>[1]) =>
        api.runProjectCommand(projectId, command, authenticatedRequest),
      getProjectHistory: (projectId: string) => api.getProjectHistory(projectId, authenticatedRequest),
      undoProjectHistory: (projectId: string) => api.undoProjectHistory(projectId, authenticatedRequest),
      redoProjectHistory: (projectId: string) => api.redoProjectHistory(projectId, authenticatedRequest),
      getThreads: () => api.getThreads(authenticatedRequest),
      getThreadById: (id: string) => api.getThreadById(id, authenticatedRequest),
      getTimelineEvents: () => api.getTimelineEvents(authenticatedRequest),
      login: (username: string, password: string) => api.login(normalizeUsername(username), password),
    }),
    [authenticatedRequest, role, userId],
  );
}
