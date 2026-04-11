import fs from 'node:fs/promises';
import path from 'node:path';

import type { CampaignV2InspectorPayload, CampaignV2ProjectSummary } from '@/features/campaign-v2/types';

import { buildCampaignV2AuthoringPayload } from './authoring';
import { buildCampaignV2MigrationChecklist } from './migration-checklist';
import { buildCampaignV2PrepPayload } from './prep';
import { buildCampaignV2GmOverview, buildCampaignV2LocationTimeline } from './resolvers';
import { loadCampaignV2Content, resolveCampaignV2Paths, CAMPAIGN_V2_DIRECTORY_BY_KIND, type CampaignV2StorageOptions } from './storage';

type CampaignProjectFile = {
  id?: string;
  name?: string;
  status?: string;
};

const CAMPAIGN_V2_CONTENT_SUBDIRS = ['campaign-v2', 'campaign-v2-shadow'] as const;

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryHasJsonFiles(directoryPath: string) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && entry.name.endsWith('.json'));
  } catch {
    return false;
  }
}

async function detectCampaignV2ContentSubdir(projectDir: string) {
  for (const contentSubdir of CAMPAIGN_V2_CONTENT_SUBDIRS) {
    for (const directoryName of Object.values(CAMPAIGN_V2_DIRECTORY_BY_KIND)) {
      if (await directoryHasJsonFiles(path.join(projectDir, contentSubdir, directoryName))) {
        return contentSubdir;
      }
    }
  }

  return null;
}

async function readProjectSummary(projectDir: string): Promise<CampaignV2ProjectSummary | null> {
  const projectFilePath = path.join(projectDir, 'project.json');

  try {
    const project = JSON.parse(await fs.readFile(projectFilePath, 'utf8')) as CampaignProjectFile;
    if (typeof project.id !== 'string' || typeof project.name !== 'string') {
      return null;
    }

    const preferredContentSubdir = await detectCampaignV2ContentSubdir(projectDir);

    return {
      id: project.id,
      name: project.name,
      status: typeof project.status === 'string' ? project.status : 'active',
      hasCampaignV2Content: preferredContentSubdir !== null,
      preferredContentSubdir,
    };
  } catch {
    return null;
  }
}

async function listProjectSummaries(campaignsRoot: string) {
  const entries = await fs.readdir(campaignsRoot, { withFileTypes: true });
  const projectSummaries: CampaignV2ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const summary = await readProjectSummary(path.join(campaignsRoot, entry.name));
    if (summary?.hasCampaignV2Content) {
      projectSummaries.push(summary);
    }
  }

  return projectSummaries.sort((left, right) => left.name.localeCompare(right.name));
}

export async function buildCampaignV2InspectorPayload(
  options: CampaignV2StorageOptions & { requestedProjectId?: string; requestedLocationId?: string },
): Promise<CampaignV2InspectorPayload> {
  const resolvedPaths = resolveCampaignV2Paths({
    ...options,
    projectId: options.projectId,
  });
  const projects = await listProjectSummaries(resolvedPaths.campaignsRoot);
  const resolvedProjectId =
    options.requestedProjectId && projects.some((project) => project.id === options.requestedProjectId)
      ? options.requestedProjectId
      : projects[0]?.id ?? options.projectId;
  const project = projects.find((entry) => entry.id === resolvedProjectId) ?? null;
  const contentSubdir = project?.preferredContentSubdir ?? options.contentSubdir ?? null;

  if (!project || !contentSubdir) {
    return {
      project,
      projects,
      selectedLocationId: null,
      locations: [],
      overview: null,
      locationTimeline: null,
      prep: null,
      authoring: null,
      migrationChecklist: null,
      contentSubdir: null,
      trustedLocationDualWriteEnabled: false,
      counts: {
        locations: 0,
        locationStates: 0,
        sessions: 0,
        events: 0,
        effects: 0,
        invalidFiles: 0,
      },
      loadedAt: new Date().toISOString(),
    };
  }

  const loadResult = await loadCampaignV2Content({
    campaignsRoot: resolvedPaths.campaignsRoot,
    schemaRoot: resolvedPaths.schemaRoot,
    projectId: resolvedProjectId,
    contentSubdir,
  });
  const resolverSource = {
    projectId: resolvedProjectId,
    loadedAt: loadResult.loadedAt,
    locations: loadResult.locations.map((entry) => entry.value),
    locationStates: loadResult.locationStates.map((entry) => entry.value),
    sessions: loadResult.sessions.map((entry) => entry.value),
    events: loadResult.events.map((entry) => entry.value),
    effects: loadResult.effects.map((entry) => entry.value),
    diagnostics: loadResult.diagnostics,
  };
  const overview = buildCampaignV2GmOverview(resolverSource);
  const locations = resolverSource.locations
    .map((location) => ({
      id: location.id,
      title: location.title,
      summary: location.summary,
      tags: [...(location.tags ?? [])],
      parentLocationId: location.parentLocationId ?? null,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  const selectedLocationId =
    options.requestedLocationId && locations.some((location) => location.id === options.requestedLocationId)
      ? options.requestedLocationId
      : overview.currentSession?.locationId ?? locations[0]?.id ?? null;

  return {
    project,
    projects,
    selectedLocationId,
    locations,
    overview,
    locationTimeline: selectedLocationId ? buildCampaignV2LocationTimeline(resolverSource, selectedLocationId) : null,
    prep: buildCampaignV2PrepPayload(resolverSource, selectedLocationId),
    authoring: buildCampaignV2AuthoringPayload(resolverSource, selectedLocationId, contentSubdir),
    migrationChecklist: buildCampaignV2MigrationChecklist({
      projectId: resolvedProjectId,
      contentSubdir,
    }),
    contentSubdir,
    trustedLocationDualWriteEnabled: false,
    counts: {
      locations: loadResult.locations.length,
      locationStates: loadResult.locationStates.length,
      sessions: loadResult.sessions.length,
      events: loadResult.events.length,
      effects: loadResult.effects.length,
      invalidFiles: loadResult.diagnostics.filter((diagnostic) => diagnostic.code !== 'REFERENCE_ERROR').length,
    },
    loadedAt: loadResult.loadedAt.toISOString(),
  };
}
