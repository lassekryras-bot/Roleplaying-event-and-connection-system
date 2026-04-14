import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDomainThreadState, type DomainThreadState } from '@/lib/thread-state';

type CampaignLegacyThreadFile = {
  id?: string;
  title?: string;
  state?: string;
  hook?: string;
  playerSummary?: string;
  gmTruth?: string;
  timelineAnchor?: string;
  patternId?: string;
};

export type CampaignLegacyThreadSummary = {
  id: string;
  title: string;
  state: DomainThreadState | null;
  hook: string | null;
  playerSummary: string | null;
  gmTruth: string | null;
  timelineAnchor: string | null;
  patternId: string | null;
};

export type CampaignLegacyThreadsOptions = {
  campaignsRoot?: string;
  projectId: string;
};

function getRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
}

function resolveCampaignsRoot(campaignsRoot?: string) {
  return campaignsRoot ?? path.join(getRepoRoot(), 'campaigns');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeThreadState(value: unknown): DomainThreadState | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return assertDomainThreadState(value.trim());
  } catch {
    return null;
  }
}

function normalizeLegacyThread(value: CampaignLegacyThreadFile): CampaignLegacyThreadSummary | null {
  const id = normalizeText(value.id);
  const title = normalizeText(value.title);
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    state: normalizeThreadState(value.state),
    hook: normalizeText(value.hook),
    playerSummary: normalizeText(value.playerSummary),
    gmTruth: normalizeText(value.gmTruth),
    timelineAnchor: normalizeText(value.timelineAnchor),
    patternId: normalizeText(value.patternId),
  };
}

export async function loadCampaignLegacyThreads(
  options: CampaignLegacyThreadsOptions,
): Promise<CampaignLegacyThreadSummary[]> {
  const threadsDir = path.join(resolveCampaignsRoot(options.campaignsRoot), options.projectId, 'threads');
  let entries;

  try {
    entries = await fs.readdir(threadsDir, { withFileTypes: true });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const threads: CampaignLegacyThreadSummary[] = [];
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith('.json')).sort((left, right) => left.name.localeCompare(right.name))) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(threadsDir, entry.name), 'utf8')) as CampaignLegacyThreadFile;
      const normalized = normalizeLegacyThread(raw);
      if (normalized) {
        threads.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return threads;
}
