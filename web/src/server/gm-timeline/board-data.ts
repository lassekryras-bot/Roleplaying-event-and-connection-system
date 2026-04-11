import fs from 'node:fs/promises';
import path from 'node:path';

import type { GmTimelineBoardPayload, GmTimelineProjectSummary } from '@/features/gm-timeline/types';

import { loadGmTimelineContent, resolveGmTimelinePaths, type GmTimelineLoaderOptions } from './loader';

type CampaignProjectFile = {
  id?: string;
  name?: string;
  status?: string;
};

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readProjectSummary(projectDir: string): Promise<GmTimelineProjectSummary | null> {
  const projectFilePath = path.join(projectDir, 'project.json');
  try {
    const project = JSON.parse(await fs.readFile(projectFilePath, 'utf8')) as CampaignProjectFile;
    const timelineFilePath = path.join(projectDir, 'gm-timeline', 'timeline.json');

    if (typeof project.id !== 'string' || typeof project.name !== 'string') {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      status: typeof project.status === 'string' ? project.status : 'active',
      hasTimelineContent: await pathExists(timelineFilePath),
    };
  } catch {
    return null;
  }
}

async function listProjectSummaries(campaignsRoot: string): Promise<GmTimelineProjectSummary[]> {
  const entries = await fs.readdir(campaignsRoot, { withFileTypes: true });
  const projectSummaries: GmTimelineProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const summary = await readProjectSummary(path.join(campaignsRoot, entry.name));
    if (summary) {
      projectSummaries.push(summary);
    }
  }

  return projectSummaries.sort((left, right) => left.name.localeCompare(right.name));
}

function countInvalidFiles(payload: Awaited<ReturnType<typeof loadGmTimelineContent>>) {
  return payload.diagnostics.filter((diagnostic) => diagnostic.code !== 'REFERENCE_ERROR').length;
}

export async function buildGmTimelineBoardPayload(
  options: GmTimelineLoaderOptions & { requestedProjectId?: string },
): Promise<GmTimelineBoardPayload> {
  const resolvedPaths = resolveGmTimelinePaths({
    ...options,
    projectId: options.projectId,
  });
  const projects = await listProjectSummaries(resolvedPaths.campaignsRoot);
  const resolvedProjectId =
    options.requestedProjectId && projects.some((project) => project.id === options.requestedProjectId)
      ? options.requestedProjectId
      : projects.find((project) => project.hasTimelineContent)?.id ?? projects[0]?.id ?? options.projectId;

  const loadResult = await loadGmTimelineContent({
    campaignsRoot: resolvedPaths.campaignsRoot,
    schemaRoot: resolvedPaths.schemaRoot,
    contentSubdir: options.contentSubdir,
    projectId: resolvedProjectId,
  });
  const project = projects.find((entry) => entry.id === resolvedProjectId) ?? null;

  return {
    project,
    projects,
    timeline: loadResult.timeline?.value ?? null,
    sessions: loadResult.sessions.map((entry) => entry.value),
    places: loadResult.places.map((entry) => entry.value),
    hooks: loadResult.hooks.map((entry) => entry.value),
    threadRefs: loadResult.threadRefs.map((entry) => entry.value),
    indexes: {
      sessionIndex: loadResult.indexes.sessionIndex?.value ?? null,
      placeIndex: loadResult.indexes.placeIndex?.value ?? null,
      hookIndex: loadResult.indexes.hookIndex?.value ?? null,
      threadIndex: loadResult.indexes.threadIndex?.value ?? null,
    },
    diagnostics: loadResult.diagnostics,
    counts: {
      filesLoaded:
        Number(Boolean(loadResult.timeline)) +
        loadResult.sessions.length +
        loadResult.places.length +
        loadResult.hooks.length +
        loadResult.threadRefs.length +
        Number(Boolean(loadResult.indexes.sessionIndex)) +
        Number(Boolean(loadResult.indexes.placeIndex)) +
        Number(Boolean(loadResult.indexes.hookIndex)) +
        Number(Boolean(loadResult.indexes.threadIndex)),
      sessions: loadResult.sessions.length,
      places: loadResult.places.length,
      hooks: loadResult.hooks.length,
      threadRefs: loadResult.threadRefs.length,
      invalidFiles: countInvalidFiles(loadResult),
    },
    loadedAt: loadResult.loadedAt.toISOString(),
  };
}
