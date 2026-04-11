// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createGmTimelineStore,
  formatGmTimelineDiagnostic,
  loadGmTimelineContent,
} from '@/server/gm-timeline';

const repoRoot = path.resolve(fileURLToPath(new URL('../../../../../', import.meta.url)));
const schemaRoot = path.join(repoRoot, 'schemas', 'gm-timeline');
const projectId = 'project-fixture';

const tempDirectories: string[] = [];

type FixtureFiles = Record<string, object | string>;

function createValidFixtureFiles(): FixtureFiles {
  return {
    'timeline.json': {
      campaignId: projectId,
      title: 'Fixture Timeline',
      currentSequence: 2,
      activeSessionId: 'session-bank-job-02',
      sessionIds: ['session-bank-job-02', 'session-bank-job-01'],
      notes: 'Fixture notes',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'sessions/index.json': {
      generatedAt: '2026-04-06T12:00:00Z',
      items: [
        {
          id: 'session-bank-job-01',
          headline: 'Scout the Bank',
          summary: 'Collect rumors and survey entrances.',
          status: 'planning',
          sequence: 1,
          file: 'sessions/session-bank-job-01.json',
        },
        {
          id: 'session-bank-job-02',
          headline: 'Run the Heist',
          summary: 'Execute the first break-in.',
          status: 'active',
          sequence: 2,
          file: 'sessions/session-bank-job-02.json',
        },
      ],
    },
    'sessions/session-bank-job-01.json': {
      id: 'session-bank-job-01',
      campaignId: projectId,
      sequence: 1,
      status: 'planning',
      headline: 'Scout the Bank',
      summary: 'Collect rumors and survey entrances.',
      expectedDirection: 'The party learns guard rotations.',
      placeIds: ['place-bank', 'place-safehouse'],
      notes: 'Scout session',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'sessions/session-bank-job-02.json': {
      id: 'session-bank-job-02',
      campaignId: projectId,
      sequence: 2,
      status: 'active',
      headline: 'Run the Heist',
      summary: 'Execute the first break-in.',
      expectedDirection: 'The party reaches the vault corridor.',
      placeIds: ['place-sewers', 'place-bank'],
      notes: 'Heist session',
      startedAt: '2026-04-06T18:00:00Z',
      updatedAt: '2026-04-06T19:00:00Z',
    },
    'places/index.json': {
      generatedAt: '2026-04-06T12:00:00Z',
      items: [
        {
          id: 'place-bank',
          headline: 'Gold Bank',
          description: 'The target bank in Alkenstar.',
          tags: ['bank', 'vault'],
          file: 'places/place-bank.json',
        },
        {
          id: 'place-safehouse',
          headline: 'Safehouse',
          description: 'A rented room over a bakery.',
          tags: ['hideout'],
          file: 'places/place-safehouse.json',
        },
        {
          id: 'place-sewers',
          headline: 'Storm Sewers',
          description: 'Old tunnels below the district.',
          tags: ['underground'],
          file: 'places/place-sewers.json',
        },
      ],
    },
    'places/place-bank.json': {
      id: 'place-bank',
      campaignId: projectId,
      headline: 'Gold Bank',
      description: 'The target bank in Alkenstar.',
      tags: ['bank', 'vault'],
      hookIds: ['hook-meet-manager', 'hook-vault-route'],
      notes: 'High security',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'places/place-safehouse.json': {
      id: 'place-safehouse',
      campaignId: projectId,
      headline: 'Safehouse',
      description: 'A rented room over a bakery.',
      tags: ['hideout'],
      hookIds: [],
      notes: 'Fallback meeting point',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'places/place-sewers.json': {
      id: 'place-sewers',
      campaignId: projectId,
      headline: 'Storm Sewers',
      description: 'Old tunnels below the district.',
      tags: ['underground'],
      hookIds: ['hook-sewer-entry'],
      notes: 'Wet and unstable',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'hooks/index.json': {
      generatedAt: '2026-04-06T12:00:00Z',
      items: [
        {
          id: 'hook-meet-manager',
          headline: 'Meet the Manager',
          placeId: 'place-bank',
          threadIds: ['thread-silent-bell'],
          file: 'hooks/hook-meet-manager.json',
        },
        {
          id: 'hook-vault-route',
          headline: 'Trace the Vault Route',
          placeId: 'place-bank',
          threadIds: ['thread-vault-route'],
          file: 'hooks/hook-vault-route.json',
        },
        {
          id: 'hook-sewer-entry',
          headline: 'Find the Sewer Entry',
          placeId: 'place-sewers',
          threadIds: ['thread-sewer-path'],
          file: 'hooks/hook-sewer-entry.json',
        },
      ],
    },
    'hooks/hook-meet-manager.json': {
      id: 'hook-meet-manager',
      campaignId: projectId,
      placeId: 'place-bank',
      headline: 'Meet the Manager',
      description: 'A social angle for learning routines.',
      status: 'available',
      priority: 'high',
      checks: [
        {
          id: 'insight-check',
          label: 'Read the manager',
          attribute: 'Insight',
          dc: 14,
          rollMode: 'd20_button',
          result: null,
          notes: '',
        },
      ],
      threadIds: ['thread-silent-bell'],
      notes: 'Can branch into leverage.',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'hooks/hook-vault-route.json': {
      id: 'hook-vault-route',
      campaignId: projectId,
      placeId: 'place-bank',
      headline: 'Trace the Vault Route',
      description: 'Observe how staff move coin carts.',
      status: 'available',
      priority: 'medium',
      checks: [],
      threadIds: ['thread-vault-route'],
      notes: 'Useful for timing.',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'hooks/hook-sewer-entry.json': {
      id: 'hook-sewer-entry',
      campaignId: projectId,
      placeId: 'place-sewers',
      headline: 'Find the Sewer Entry',
      description: 'Locate a maintenance hatch.',
      status: 'available',
      priority: 'medium',
      checks: [],
      threadIds: ['thread-sewer-path'],
      notes: 'Needs navigation.',
      updatedAt: '2026-04-06T12:00:00Z',
    },
    'threads/index.json': {
      generatedAt: '2026-04-06T12:00:00Z',
      items: [
        {
          id: 'thread-silent-bell',
          title: 'Silent Bell',
          summary: 'A quiet warning system around the vault.',
          linkedHookIds: ['hook-meet-manager'],
          file: 'threads/thread-silent-bell.json',
        },
        {
          id: 'thread-vault-route',
          title: 'Vault Route',
          summary: 'Coin carts follow a predictable path.',
          linkedHookIds: ['hook-vault-route'],
          file: 'threads/thread-vault-route.json',
        },
        {
          id: 'thread-sewer-path',
          title: 'Sewer Path',
          summary: 'A damp approach to the bank.',
          linkedHookIds: ['hook-sewer-entry'],
          file: 'threads/thread-sewer-path.json',
        },
      ],
    },
    'threads/thread-silent-bell.json': {
      id: 'thread-silent-bell',
      title: 'Silent Bell',
      summary: 'A quiet warning system around the vault.',
      linkedHookIds: ['hook-meet-manager'],
      playerVisible: false,
    },
    'threads/thread-vault-route.json': {
      id: 'thread-vault-route',
      title: 'Vault Route',
      summary: 'Coin carts follow a predictable path.',
      linkedHookIds: ['hook-vault-route'],
      playerVisible: false,
    },
    'threads/thread-sewer-path.json': {
      id: 'thread-sewer-path',
      title: 'Sewer Path',
      summary: 'A damp approach to the bank.',
      linkedHookIds: ['hook-sewer-entry'],
      playerVisible: false,
    },
  };
}

async function createFixtureWorkspace(files: FixtureFiles) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gm-timeline-'));
  tempDirectories.push(root);

  const campaignsRoot = path.join(root, 'campaigns');
  const contentRoot = path.join(campaignsRoot, projectId, 'gm-timeline');

  for (const [relativePath, payload] of Object.entries(files)) {
    const filePath = path.join(contentRoot, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const contents =
      typeof payload === 'string' ? payload : `${JSON.stringify(payload, null, 2)}\n`;
    await fs.writeFile(filePath, contents, 'utf8');
  }

  return {
    campaignsRoot,
    contentRoot,
  };
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('gm timeline content layer', () => {
  it('loads a valid project into the in-memory store with no diagnostics', async () => {
    const workspace = await createFixtureWorkspace(createValidFixtureFiles());
    const loadResult = await loadGmTimelineContent({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });

    expect(loadResult.diagnostics).toEqual([]);
    expect(loadResult.timeline?.value.activeSessionId).toBe('session-bank-job-02');
    expect(loadResult.sessions).toHaveLength(2);
    expect(loadResult.places).toHaveLength(3);
    expect(loadResult.hooks).toHaveLength(3);
    expect(loadResult.threadRefs).toHaveLength(3);
    expect(loadResult.indexes.sessionIndex?.value.items).toHaveLength(2);

    const store = await createGmTimelineStore({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });
    expect(store.getDiagnostics()).toEqual([]);

    const timeline = store.getTimeline();
    expect(timeline?.sessions.map((session) => session.id)).toEqual([
      'session-bank-job-02',
      'session-bank-job-01',
    ]);
  });

  it('reports readable validation errors and keeps other valid files available', async () => {
    const files = createValidFixtureFiles();
    const brokenSession = structuredClone(files['sessions/session-bank-job-02.json'] as object) as Record<string, unknown>;
    delete brokenSession.headline;
    files['sessions/session-bank-job-02.json'] = brokenSession;
    files['hooks/hook-bad.json'] = '{"id":"hook-bad",';
    files['hooks/index.json'] = {
      bad: true,
    };

    const workspace = await createFixtureWorkspace(files);
    const loadResult = await loadGmTimelineContent({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });

    const diagnostics = loadResult.diagnostics;
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.some((diagnostic) => diagnostic.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    expect(diagnostics.some((diagnostic) => diagnostic.code === 'JSON_PARSE_ERROR')).toBe(true);

    const sessionDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.relativePath === 'sessions/session-bank-job-02.json',
    );
    expect(sessionDiagnostic).toMatchObject({
      code: 'SCHEMA_VALIDATION_ERROR',
      contentKind: 'session',
    });
    expect(formatGmTimelineDiagnostic(sessionDiagnostic!)).toContain(
      'sessions/session-bank-job-02.json failed session.schema.json: /headline is required',
    );

    const store = await createGmTimelineStore({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });

    expect(store.searchSessions('scout').map((session) => session.id)).toEqual(['session-bank-job-01']);
    expect(store.getSessionById('session-bank-job-02')).toBeNull();
  });

  it('resolves linked content, preserves link ordering, and filters missing references', async () => {
    const files = createValidFixtureFiles();
    const placeBank = structuredClone(files['places/place-bank.json'] as object) as Record<string, unknown>;
    placeBank.hookIds = ['hook-vault-route', 'hook-meet-manager', 'hook-missing'];
    files['places/place-bank.json'] = placeBank;

    const workspace = await createFixtureWorkspace(files);
    const store = await createGmTimelineStore({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });

    const sessionView = store.getSessionById('session-bank-job-02');
    expect(sessionView?.places.map((place) => place.id)).toEqual(['place-sewers', 'place-bank']);

    const hooks = store.getHooksForPlace('place-bank');
    expect(hooks.map(({ hook }) => hook.id)).toEqual(['hook-vault-route', 'hook-meet-manager']);
    expect(hooks[0]?.threads.map((thread) => thread.id)).toEqual(['thread-vault-route']);

    expect(store.getDiagnostics().some((diagnostic) => diagnostic.code === 'REFERENCE_ERROR')).toBe(true);
    expect(store.searchHooks('vault').map((hook) => hook.id)).toEqual(['hook-vault-route']);
  });

  it('refreshes content so external file additions appear in searches', async () => {
    const files = createValidFixtureFiles();
    delete files['places/place-sewers.json'];
    files['places/index.json'] = {
      generatedAt: '2026-04-06T12:00:00Z',
      items: [
        {
          id: 'place-bank',
          headline: 'Gold Bank',
          description: 'The target bank in Alkenstar.',
          tags: ['bank', 'vault'],
          file: 'places/place-bank.json',
        },
        {
          id: 'place-safehouse',
          headline: 'Safehouse',
          description: 'A rented room over a bakery.',
          tags: ['hideout'],
          file: 'places/place-safehouse.json',
        },
      ],
    };

    const workspace = await createFixtureWorkspace(files);
    const store = await createGmTimelineStore({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });

    expect(store.searchPlaces('sewer')).toEqual([]);

    const newPlacePath = path.join(workspace.contentRoot, 'places', 'place-docks.json');
    await fs.mkdir(path.dirname(newPlacePath), { recursive: true });
    await fs.writeFile(
      newPlacePath,
      `${JSON.stringify(
        {
          id: 'place-docks',
          campaignId: projectId,
          headline: 'North Docks',
          description: 'A quieter loading area for escape routes.',
          tags: ['docks', 'escape'],
          hookIds: [],
          notes: 'Useful fallback exit',
          updatedAt: '2026-04-06T21:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(workspace.contentRoot, 'places', 'index.json'),
      `${JSON.stringify(
        {
          generatedAt: '2026-04-06T21:00:00Z',
          items: [
            {
              id: 'place-bank',
              headline: 'Gold Bank',
              description: 'The target bank in Alkenstar.',
              tags: ['bank', 'vault'],
              file: 'places/place-bank.json',
            },
            {
              id: 'place-safehouse',
              headline: 'Safehouse',
              description: 'A rented room over a bakery.',
              tags: ['hideout'],
              file: 'places/place-safehouse.json',
            },
            {
              id: 'place-docks',
              headline: 'North Docks',
              description: 'A quieter loading area for escape routes.',
              tags: ['docks', 'escape'],
              file: 'places/place-docks.json',
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await store.refresh();

    expect(store.searchPlaces('docks').map((place) => place.id)).toEqual(['place-docks']);

    const reloadedContent = await loadGmTimelineContent({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    });
    expect(reloadedContent.indexes.placeIndex?.value.items.map((item) => item.id)).toContain('place-docks');
  });
});
