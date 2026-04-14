'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useApiClient } from '@/lib/use-api-client';
import type { ProjectSummary } from '@/lib/api';

import { useAuth } from './auth-context';

type CampaignSelectionContextValue = {
  selectedProjectId: string;
  projectOptions: ProjectSummary[];
  selectionReady: boolean;
  isCampaignScopedRoute: boolean;
  buildCampaignHref: (href: string) => string;
  selectProject: (projectId: string) => Promise<string | null>;
};

const CampaignSelectionContext = createContext<CampaignSelectionContextValue | null>(null);

function normalizeProjectId(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isCampaignScopedPath(pathname: string) {
  return (
    pathname === '/project' ||
    pathname === '/timeline' ||
    pathname === '/player-characters' ||
    pathname.startsWith('/player-characters/')
  );
}

function isPlayerCharacterDetailPath(pathname: string) {
  return pathname.startsWith('/player-characters/') && pathname !== '/player-characters';
}

function resolveSelectedProjectId(
  requestedProjectId: string | null,
  preferredProjectId: string | null,
  projectOptions: ProjectSummary[],
) {
  const knownProjectIds = new Set(projectOptions.map((project) => project.id));

  if (requestedProjectId && knownProjectIds.has(requestedProjectId)) {
    return requestedProjectId;
  }

  if (preferredProjectId && knownProjectIds.has(preferredProjectId)) {
    return preferredProjectId;
  }

  return projectOptions[0]?.id ?? null;
}

function withProjectSearchParam(href: string, projectId: string) {
  const [pathname, search = ''] = href.split('?');
  if (!isCampaignScopedPath(pathname)) {
    return href;
  }

  const nextParams = new URLSearchParams(search);
  nextParams.set('project', projectId);

  if (pathname !== '/timeline') {
    nextParams.delete('location');
  }

  return `${pathname}${nextParams.size > 0 ? `?${nextParams.toString()}` : ''}`;
}

export function CampaignSelectionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const { isAuthenticated, role, userId } = useAuth();
  const { getProjects, getPreferredProject, savePreferredProject } = useApiClient();
  const [projectOptions, setProjectOptions] = useState<ProjectSummary[]>([]);
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectionReady, setSelectionReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !role || !userId) {
      setProjectOptions([]);
      setPreferredProjectId(null);
      setSelectedProjectId('');
      setSelectionReady(true);
      return () => {
        active = false;
      };
    }

    setSelectionReady(false);

    Promise.all([
      getProjects().catch(() => [] as ProjectSummary[]),
      getPreferredProject().catch(() => ({ project_id: null as string | null })),
    ])
      .then(([projects, preference]) => {
        if (!active) {
          return;
        }

        setProjectOptions(projects);
        setPreferredProjectId(normalizeProjectId(preference.project_id));
      })
      .finally(() => {
        if (active) {
          setSelectionReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [getPreferredProject, getProjects, isAuthenticated, role, userId]);

  const requestedProjectId = normalizeProjectId(searchParams.get('project'));
  const resolvedProjectId = useMemo(
    () => resolveSelectedProjectId(requestedProjectId, preferredProjectId, projectOptions),
    [preferredProjectId, projectOptions, requestedProjectId],
  );
  const isCampaignScopedRoute = isCampaignScopedPath(pathname);

  useEffect(() => {
    if (!selectionReady) {
      return;
    }

    const nextProjectId = resolvedProjectId ?? '';
    setSelectedProjectId((currentProjectId) => (currentProjectId === nextProjectId ? currentProjectId : nextProjectId));
  }, [resolvedProjectId, selectionReady]);

  useEffect(() => {
    if (!selectionReady || !isCampaignScopedRoute || !selectedProjectId) {
      return;
    }

    if (requestedProjectId === selectedProjectId) {
      return;
    }

    const nextHref = withProjectSearchParam(
      `${pathname}${searchParamsString.length > 0 ? `?${searchParamsString}` : ''}`,
      selectedProjectId,
    );
    router.replace(nextHref);
  }, [
    isCampaignScopedRoute,
    pathname,
    requestedProjectId,
    router,
    searchParamsString,
    selectedProjectId,
    selectionReady,
  ]);

  const updateCurrentRouteForProject = useCallback(
    (projectId: string) => {
      if (!isCampaignScopedRoute) {
        return;
      }

      if (isPlayerCharacterDetailPath(pathname)) {
        router.replace(`/player-characters?project=${encodeURIComponent(projectId)}`);
        return;
      }

      const nextParams = new URLSearchParams(searchParamsString);
      nextParams.set('project', projectId);

      if (pathname === '/timeline') {
        nextParams.delete('location');
      }

      router.replace(`${pathname}${nextParams.size > 0 ? `?${nextParams.toString()}` : ''}`);
    },
    [isCampaignScopedRoute, pathname, router, searchParamsString],
  );

  const selectProject = useCallback(
    async (projectId: string) => {
      const normalizedProjectId = normalizeProjectId(projectId);
      if (!normalizedProjectId) {
        return null;
      }

      if (!projectOptions.some((project) => project.id === normalizedProjectId)) {
        return selectedProjectId || null;
      }

      setSelectedProjectId(normalizedProjectId);
      setPreferredProjectId(normalizedProjectId);
      updateCurrentRouteForProject(normalizedProjectId);

      if (!isAuthenticated || !role || !userId) {
        return normalizedProjectId;
      }

      try {
        const response = await savePreferredProject(normalizedProjectId);
        const savedProjectId = normalizeProjectId(response.project_id) ?? normalizedProjectId;
        setPreferredProjectId(savedProjectId);
        setSelectedProjectId(savedProjectId);

        if (savedProjectId !== normalizedProjectId) {
          updateCurrentRouteForProject(savedProjectId);
        }

        return savedProjectId;
      } catch {
        return normalizedProjectId;
      }
    },
    [
      isAuthenticated,
      projectOptions,
      role,
      savePreferredProject,
      selectedProjectId,
      updateCurrentRouteForProject,
      userId,
    ],
  );

  const buildCampaignHref = useCallback(
    (href: string) => {
      if (!selectedProjectId) {
        return href;
      }

      return withProjectSearchParam(href, selectedProjectId);
    },
    [selectedProjectId],
  );

  const value = useMemo(
    () => ({
      selectedProjectId,
      projectOptions,
      selectionReady,
      isCampaignScopedRoute,
      buildCampaignHref,
      selectProject,
    }),
    [
      buildCampaignHref,
      isCampaignScopedRoute,
      projectOptions,
      selectProject,
      selectedProjectId,
      selectionReady,
    ],
  );

  return <CampaignSelectionContext.Provider value={value}>{children}</CampaignSelectionContext.Provider>;
}

export function useCampaignSelection() {
  const context = useContext(CampaignSelectionContext);
  if (!context) {
    throw new Error('useCampaignSelection must be used within a CampaignSelectionProvider.');
  }

  return context;
}
