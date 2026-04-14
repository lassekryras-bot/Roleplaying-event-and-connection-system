// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateTrustedLocationIdentityDualWrite } from '@/server/campaign-v2';

const repoRoot = path.resolve(fileURLToPath(new URL('../../../../../', import.meta.url)));
const campaignV2SchemaRoot = path.join(repoRoot, 'schemas', 'campaign-v2');
const projectId = 'project-fixture';

const tempDirectories: string[] = [];

async function writeJsonFile(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-v2-dual-write-'));
  tempDirectories.push(root);

  return {
    root,
    campaignsRoot: path.join(root, 'campaigns'),
  };
}

async function seedProjectFile(campaignsRoot: string) {
  await writeJsonFile(path.join(campaignsRoot, projectId, 'project.json'), {
    id: projectId,
    name: 'Fixture Project',
    status: 'active',
  });
}

async function seedV2Location(campaignsRoot: string) {
  await writeJsonFile(path.join(campaignsRoot, projectId, 'campaign-v2', 'locations', 'location-ash-market.json'), {
    id: 'location-ash-market',
    type: 'location',
    campaignId: projectId,
    title: 'Ash Market',
    summary: 'The old soot market.',
    tags: ['market', 'district'],
    relations: [],
  });
}

async function seedGmTimeline(campaignsRoot: string, { includePlace = true }: { includePlace?: boolean } = {}) {
  const contentRoot = path.join(campaignsRoot, projectId, 'gm-timeline');

  await writeJsonFile(path.join(contentRoot, 'timeline.json'), {
    campaignId: projectId,
    title: 'Fixture Timeline',
    currentSequence: 0,
    activeSessionId: null,
    sessionIds: [],
    updatedAt: '2026-04-11T22:20:00Z',
  });

  await writeJsonFile(path.join(contentRoot, 'places', 'index.json'), {
    generatedAt: '2026-04-11T22:20:00Z',
    items: includePlace
      ? [
          {
            id: 'place-ash-market',
            headline: 'Ash Market',
            description: 'The old soot market.',
            tags: ['market', 'district'],
            file: 'places/place-ash-market.json',
          },
        ]
      : [],
  });

  if (includePlace) {
    await writeJsonFile(path.join(contentRoot, 'places', 'place-ash-market.json'), {
      id: 'place-ash-market',
      campaignId: projectId,
      headline: 'Ash Market',
      description: 'The old soot market.',
      tags: ['market', 'district'],
      hookIds: [],
      updatedAt: '2026-04-11T22:20:00Z',
    });
  }
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('trusted location identity dual-write', () => {
  it('is frozen once campaign-v2 becomes the only write path', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const workspace = await createWorkspace();
    await seedProjectFile(workspace.campaignsRoot);
    await seedV2Location(workspace.campaignsRoot);
    await seedGmTimeline(workspace.campaignsRoot);

    const result = await updateTrustedLocationIdentityDualWrite({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      locationId: 'location-ash-market',
      input: {
        title: 'Ash Market North Gate',
        summary: 'A busier soot market watched by tense guards.',
        tags: ['market', 'guards', 'district'],
      },
    });

    expect(result.report.success).toBe(false);
    expect(result.report.divergence).toBe(true);
    expect(result.report.divergenceReasons).toEqual([
      'Legacy dual-write is frozen. Use the guided campaign-v2 authoring flow instead.',
    ]);
    expect(result.report.oldWrite.success).toBe(false);
    expect(result.report.newWrite.success).toBe(false);

    const writtenLocation = JSON.parse(
      await fs.readFile(
        path.join(workspace.campaignsRoot, projectId, 'campaign-v2', 'locations', 'location-ash-market.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(writtenLocation.title).toBe('Ash Market');
    expect(writtenLocation.summary).toBe('The old soot market.');
    expect(writtenLocation.tags).toEqual(['market', 'district']);

    const writtenPlace = JSON.parse(
      await fs.readFile(path.join(workspace.campaignsRoot, projectId, 'gm-timeline', 'places', 'place-ash-market.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(writtenPlace.headline).toBe('Ash Market');
    expect(writtenPlace.description).toBe('The old soot market.');
    expect(writtenPlace.tags).toEqual(['market', 'district']);
  });

  it('returns the same frozen report even when the old counterpart is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const workspace = await createWorkspace();
    await seedProjectFile(workspace.campaignsRoot);
    await seedV2Location(workspace.campaignsRoot);
    await seedGmTimeline(workspace.campaignsRoot, { includePlace: false });

    const result = await updateTrustedLocationIdentityDualWrite({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      locationId: 'location-ash-market',
      input: {
        title: 'Ash Market North Gate',
        summary: 'A busier soot market watched by tense guards.',
        tags: ['market', 'guards', 'district'],
      },
    });

    expect(result.report.success).toBe(false);
    expect(result.report.divergence).toBe(true);
    expect(result.report.divergenceReasons).toEqual([
      'Legacy dual-write is frozen. Use the guided campaign-v2 authoring flow instead.',
    ]);
    expect(result.report.oldWrite.success).toBe(false);
    expect(result.report.newWrite.success).toBe(false);

    const untouchedLocation = JSON.parse(
      await fs.readFile(
        path.join(workspace.campaignsRoot, projectId, 'campaign-v2', 'locations', 'location-ash-market.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(untouchedLocation.title).toBe('Ash Market');
    expect(untouchedLocation.summary).toBe('The old soot market.');
  });
});
