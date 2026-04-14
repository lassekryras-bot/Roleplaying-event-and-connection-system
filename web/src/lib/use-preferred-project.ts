'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useApiClient } from '@/lib/use-api-client';

function normalizeProjectId(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function usePreferredProject() {
  const { isAuthenticated, role, userId } = useAuth();
  const { getPreferredProject, savePreferredProject } = useApiClient();
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !role || !userId) {
      setPreferredProjectId(null);
      setPreferenceLoaded(true);
      return () => {
        active = false;
      };
    }

    if (typeof getPreferredProject !== 'function') {
      setPreferredProjectId(null);
      setPreferenceLoaded(true);
      return () => {
        active = false;
      };
    }

    setPreferenceLoaded(false);
    setPreferredProjectId(null);

    getPreferredProject()
      .then((response) => {
        if (!active) {
          return;
        }

        setPreferredProjectId(normalizeProjectId(response.project_id));
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setPreferredProjectId(null);
      })
      .finally(() => {
        if (active) {
          setPreferenceLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [getPreferredProject, isAuthenticated, role, userId]);

  return useMemo(
    () => ({
      preferredProjectId,
      preferenceLoaded,
      rememberProject: async (projectId: string | null | undefined) => {
        const normalizedProjectId = normalizeProjectId(projectId);
        if (!normalizedProjectId || normalizedProjectId === preferredProjectId) {
          return normalizedProjectId;
        }

        setPreferredProjectId(normalizedProjectId);

        if (!isAuthenticated || !role || !userId) {
          return normalizedProjectId;
        }

        if (typeof savePreferredProject !== 'function') {
          return normalizedProjectId;
        }

        try {
          const response = await savePreferredProject(normalizedProjectId);
          const savedProjectId = normalizeProjectId(response.project_id);
          setPreferredProjectId(savedProjectId);
          return savedProjectId;
        } catch {
          return normalizedProjectId;
        }
      },
    }),
    [isAuthenticated, preferenceLoaded, preferredProjectId, role, savePreferredProject, userId],
  );
}
