// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { Effect, Event, Location, LocationState, Session } from '@/generated/campaign-v2';
import {
  createInitialLocationState,
  createPostMajorVisitLocationState,
  createCampaignV2Session,
  createCampaignV2Store,
  getLocation,
  getSession,
  linkLocationStateToLocation,
  resolveCampaignV2Session,
  listEffects,
  listEvents,
  listLocations,
  listLocationStates,
  listSessions,
  loadCampaignV2Content,
  resolveCampaignV2Paths,
  saveEffect,
  saveEvent,
  saveLocation,
  saveLocationState,
  saveSession,
} from '@/server/campaign-v2';
import { loadGmTimelineContent } from '@/server/gm-timeline';

const repoRoot = path.resolve(fileURLToPath(new URL('../../../../../', import.meta.url)));
const schemaRoot = path.join(repoRoot, 'schemas', 'campaign-v2');
const gmSchemaRoot = path.join(repoRoot, 'schemas', 'gm-timeline');
const projectId = 'project-fixture';

const tempDirectories: string[] = [];

function createLocation(): Location {
  return {
    id: 'location-ash-market',
    type: 'location',
    campaignId: projectId,
    title: 'Ash Market',
    summary: 'A soot-covered market district recovering after a riot.',
    tags: ['market', 'district'],
  };
}

function createLocationState(): LocationState {
  return {
    id: 'location-state-ash-market-after-riot',
    type: 'locationState',
    locationId: 'location-ash-market',
    title: 'After the Riot',
    summary: 'The district is tense but open for business.',
    status: 'active',
    notes: 'Smoke stains remain on the shutters while guards patrol. Watch for witnesses who saw the riot leaders.',
  };
}

function createSession(): Session {
  return createCampaignV2Session({
    id: 'session-ash-market-01',
    title: 'Return to Ash Market',
    locationId: 'location-ash-market',
    summary: 'The crew returns to learn who profited from the riot.',
    startingLocationStateId: 'location-state-ash-market-after-riot',
    resultingLocationStateId: 'location-state-ash-market-after-riot',
    notes: 'Open with the market bells ringing again.',
  });
}

function createEvent(): Event {
  return {
    id: 'event-merchant-strike',
    type: 'event',
    title: 'Merchant Strike',
    summary: 'Vendors threaten to close the square unless the guard backs off.',
    status: 'available',
    eventType: 'consequence-triggered',
    createdEffectIds: ['effect-heightened-security'],
    notes: 'Can escalate if the players mishandle the guildmaster.',
  };
}

function createEffect(): Effect {
  return {
    id: 'effect-heightened-security',
    type: 'effect',
    title: 'Heightened Security',
    summary: 'Extra patrols and checkpoints slow movement through the district.',
    status: 'active',
    effectType: 'pressure',
    scope: 'local',
    severity: 'medium',
    notes: 'Applies to every Ash Market approach scene.',
  };
}

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-v2-store-'));
  tempDirectories.push(root);

  return {
    campaignsRoot: path.join(root, 'campaigns'),
  };
}

async function writeJsonFile(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function seedMinimalGmTimeline(campaignsRoot: string) {
  const contentRoot = path.join(campaignsRoot, projectId, 'gm-timeline');

  await writeJsonFile(path.join(contentRoot, 'timeline.json'), {
    campaignId: projectId,
    title: 'GM Fixture',
    currentSequence: 1,
    activeSessionId: 'session-docks-01',
    sessionIds: ['session-docks-01'],
    updatedAt: '2026-04-06T12:00:00Z',
  });

  await writeJsonFile(path.join(contentRoot, 'sessions', 'session-docks-01.json'), {
    id: 'session-docks-01',
    campaignId: projectId,
    sequence: 1,
    status: 'active',
    headline: 'Smoke on the Quay',
    summary: 'Meet the contact at the docks.',
    placeIds: ['place-brass-docks'],
    startedAt: '2026-04-06T18:00:00Z',
    updatedAt: '2026-04-06T18:00:00Z',
  });

  await writeJsonFile(path.join(contentRoot, 'places', 'place-brass-docks.json'), {
    id: 'place-brass-docks',
    campaignId: projectId,
    headline: 'Brass Docks',
    description: 'Fog and rumors.',
    hookIds: ['hook-ghost-barge'],
    tags: ['docks'],
    updatedAt: '2026-04-06T18:00:00Z',
  });

  await writeJsonFile(path.join(contentRoot, 'hooks', 'hook-ghost-barge.json'), {
    id: 'hook-ghost-barge',
    campaignId: projectId,
    placeId: 'place-brass-docks',
    headline: 'Ghost Barge',
    description: 'A quiet smuggling lead.',
    status: 'available',
    checks: [],
    threadIds: ['thread-ghost-barge'],
    updatedAt: '2026-04-06T18:00:00Z',
  });

  await writeJsonFile(path.join(contentRoot, 'threads', 'thread-ghost-barge.json'), {
    id: 'thread-ghost-barge',
    title: 'Ghost Barge',
    summary: 'Tracks the smuggling route.',
    linkedHookIds: ['hook-ghost-barge'],
  });
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('campaign-v2 storage', () => {
  it('saves and reloads campaign-v2 documents with the new content root', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };

    await saveLocation(storageOptions, createLocation());
    await saveLocationState(storageOptions, createLocationState());
    await saveEvent(storageOptions, createEvent());
    await saveEffect(storageOptions, createEffect());
    await saveSession(storageOptions, createSession());

    const resolvedPaths = resolveCampaignV2Paths(storageOptions);
    expect(resolvedPaths.contentRoot).toContain(path.join(projectId, 'campaign-v2'));

    const loadResult = await loadCampaignV2Content(storageOptions);
    expect(loadResult.diagnostics).toEqual([]);
    expect(loadResult.locations).toHaveLength(1);
    expect(loadResult.locationStates).toHaveLength(1);
    expect(loadResult.sessions).toHaveLength(1);
    expect(loadResult.events).toHaveLength(1);
    expect(loadResult.effects).toHaveLength(1);
    expect(loadResult.locations[0]?.value).toEqual(
      expect.objectContaining({
        id: 'location-ash-market',
        type: 'location',
        campaignId: projectId,
        title: 'Ash Market',
        summary: 'A soot-covered market district recovering after a riot.',
        tags: ['market', 'district'],
        relations: [],
      }),
    );
    expect(loadResult.locations[0]?.value.relations).toEqual([]);
    expect(loadResult.locationStates[0]?.value.relations).toEqual([]);
    expect(loadResult.sessions[0]?.value.relations).toEqual([]);
    expect(loadResult.events[0]?.value.relations).toEqual([]);
    expect(loadResult.effects[0]?.value.relations).toEqual([]);

    expect((await getLocation(storageOptions, 'location-ash-market'))?.title).toBe('Ash Market');
    expect((await getLocation(storageOptions, 'location-ash-market'))?.relations).toEqual([]);
    expect((await getSession(storageOptions, 'session-ash-market-01'))?.locationId).toBe('location-ash-market');
    expect((await getSession(storageOptions, 'session-ash-market-01'))?.relations).toEqual([]);
    expect((await listLocations(storageOptions)).map((location) => location.id)).toEqual(['location-ash-market']);
    expect((await listLocationStates(storageOptions)).map((locationState) => locationState.id)).toEqual([
      'location-state-ash-market-after-riot',
    ]);
    expect((await listSessions(storageOptions)).map((session) => session.id)).toEqual(['session-ash-market-01']);
    expect((await listEvents(storageOptions)).map((event) => event.id)).toEqual(['event-merchant-strike']);
    expect((await listEffects(storageOptions)).map((effect) => effect.id)).toEqual(['effect-heightened-security']);

    const store = await createCampaignV2Store(storageOptions);
    expect(store.getDiagnostics()).toEqual([]);
    expect(store.getSession('session-ash-market-01')?.startingLocationStateId).toBe('location-state-ash-market-after-riot');
    expect(store.getSession('session-ash-market-01')?.relations).toEqual([]);
    expect(store.getSnapshot().effects.map((effect) => effect.id)).toEqual(['effect-heightened-security']);
  });

  it('rejects invalid writes before they reach disk', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };

    await saveLocation(storageOptions, createLocation());

    await expect(
      saveSession(storageOptions, {
        id: 'session-ash-market-invalid',
        type: 'session',
        title: 'Broken Session',
        locationId: 'location-ash-market',
      } as unknown as Session),
    ).rejects.toThrow('/summary is required');

    expect(await listSessions(storageOptions)).toEqual([]);
  });

  it('enforces id prefixes and filename conventions', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };

    await expect(
      saveLocation(storageOptions, {
        ...createLocation(),
        id: 'place-legacy-market',
      } as unknown as Location),
    ).rejects.toThrow('Expected location ids to start with location-');

    const invalidPath = path.join(
      workspace.campaignsRoot,
      projectId,
      'campaign-v2',
      'locations',
      'location-mismatched-file.json',
    );
    await writeJsonFile(invalidPath, {
      ...createLocation(),
      id: 'location-right-name',
    });

    const loadResult = await loadCampaignV2Content(storageOptions);
    expect(loadResult.locations).toHaveLength(0);
    expect(loadResult.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ID_CONVENTION_ERROR',
        contentKind: 'location',
        sourceName: 'locations/location-mismatched-file.json',
      }),
    );
  });

  it('round-trips linked documents through the in-memory store without reference diagnostics', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };
    const store = await createCampaignV2Store(storageOptions);

    await store.saveLocation(createLocation());
    await store.saveLocationState(createLocationState());
    await store.saveEvent(createEvent());
    await store.saveEffect(createEffect());
    await store.saveSession(createSession());

    expect(store.getDiagnostics()).toEqual([]);
    expect(store.getLocationState('location-state-ash-market-after-riot')?.notes).toContain('Smoke stains remain');
    expect(store.getSession('session-ash-market-01')?.notes).toContain('Open with the market bells');
    expect(store.listSessions()[0]?.resultingLocationStateId).toBe('location-state-ash-market-after-riot');
  });

  it('supports one initial and one post-major-visit state for the same important location', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };

    const location = createLocation();
    const initialState = createInitialLocationState(location, {
      notes: 'Before the crew visits, merchants still trust the square.',
    });
    const postMajorVisitState = createPostMajorVisitLocationState(location, {
      summary: 'The market reopens under heavy guard after the crew confronts the guildmaster.',
      notes: 'Use this after the major Ash Market fallout session.',
    });

    await saveLocation(storageOptions, location);
    await saveLocationState(storageOptions, initialState);
    await saveLocationState(storageOptions, postMajorVisitState);

    const store = await createCampaignV2Store(storageOptions);
    const ashMarketStates = store
      .listLocationStates()
      .filter((locationState) => locationState.locationId === location.id)
      .sort((left, right) => left.id.localeCompare(right.id));

    expect(ashMarketStates.map((locationState) => locationState.id)).toEqual([
      'location-state-ash-market-initial',
      'location-state-ash-market-post-major-visit',
    ]);
    expect(ashMarketStates.map((locationState) => locationState.title)).toEqual([
      'Ash Market Before Visit',
      'Ash Market After Major Visit',
    ]);
    expect(ashMarketStates.map((locationState) => locationState.status)).toEqual(['available', 'active']);
    expect(linkLocationStateToLocation(ashMarketStates[0]!, location)).toEqual({
      location,
      locationState: ashMarketStates[0],
    });
    expect(linkLocationStateToLocation(ashMarketStates[1]!, location)).toEqual({
      location,
      locationState: ashMarketStates[1],
    });

    const session = createCampaignV2Session({
      id: 'session-ash-market-major-visit',
      title: 'Ash Market Fallout',
      locationId: location.id,
      summary: 'The crew returns after the guildmaster confrontation.',
      startingLocationStateId: ashMarketStates[0]!.id,
      resultingLocationStateId: ashMarketStates[1]!.id,
      notes: 'Historical record of the major visit.',
    });

    await saveSession(storageOptions, session);
    await store.refresh();
    const storedSession = store.getSession(session.id);

    expect(resolveCampaignV2Session(storedSession!, [location], store.listLocationStates())).toEqual({
      session: storedSession,
      location,
      startingLocationState: store.getLocationState(ashMarketStates[0]!.id),
      resultingLocationState: store.getLocationState(ashMarketStates[1]!.id),
    });
  });

  it('builds relation graph helpers and reports missing relation targets', async () => {
    const workspace = await createWorkspace();
    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };

    await saveLocation(storageOptions, createLocation());
    await saveEvent(storageOptions, {
      ...createEvent(),
      relations: [{ type: 'relatedTo', targetId: 'session-ash-market-graph' }],
    });
    await saveSession(storageOptions, createCampaignV2Session({
      id: 'session-ash-market-graph',
      title: 'Graph Session',
      locationId: 'location-ash-market',
      summary: 'Checks relation graph traversal.',
      relations: [
        { type: 'occursAt', targetId: 'location-ash-market' },
        { type: 'dependsOn', targetId: 'event-merchant-strike' },
        { type: 'dependsOn', targetId: 'event-missing-scout' },
      ],
    }));

    const store = await createCampaignV2Store(storageOptions);
    expect(store.getDiagnostics()).toContainEqual(
      expect.objectContaining({
        code: 'REFERENCE_ERROR',
        contentKind: 'session',
        sourceName: 'sessions/session-ash-market-graph.json',
        message: 'session session-ash-market-graph relation dependsOn references missing target event-missing-scout.',
      }),
    );

    const dependsOnRelations = store.getRelationsByType('session-ash-market-graph', 'dependsOn');
    expect(dependsOnRelations.map((relation) => relation.targetId)).toEqual([
      'event-merchant-strike',
      'event-missing-scout',
    ]);
    expect(store.resolveTarget(dependsOnRelations[0]!)).toEqual(expect.objectContaining({ id: 'event-merchant-strike' }));
    expect(store.resolveTarget(dependsOnRelations[1]!)).toBeNull();

    expect(store.getObjectsRelatedTo('session-ash-market-graph')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          object: expect.objectContaining({ id: 'event-merchant-strike' }),
          direction: 'both',
        }),
        expect.objectContaining({
          object: expect.objectContaining({ id: 'location-ash-market' }),
          direction: 'outgoing',
        }),
      ]),
    );
  });

  it('leaves the old gm-timeline loader behavior unchanged when campaign-v2 content is missing or present', async () => {
    const workspace = await createWorkspace();
    await seedMinimalGmTimeline(workspace.campaignsRoot);

    const beforeV2 = await loadGmTimelineContent({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: gmSchemaRoot,
      projectId,
    });

    expect(beforeV2.diagnostics).toEqual([]);
    expect(beforeV2.sessions).toHaveLength(1);
    expect(beforeV2.places).toHaveLength(1);
    expect(beforeV2.hooks).toHaveLength(1);
    expect(beforeV2.threadRefs).toHaveLength(1);

    const storageOptions = {
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot,
      projectId,
    };
    await saveLocation(storageOptions, createLocation());
    await saveLocationState(storageOptions, createLocationState());
    await saveEvent(storageOptions, createEvent());
    await saveEffect(storageOptions, createEffect());
    await saveSession(storageOptions, createSession());

    const afterV2 = await loadGmTimelineContent({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: gmSchemaRoot,
      projectId,
    });

    expect(afterV2.diagnostics).toEqual([]);
    expect(afterV2.sessions).toHaveLength(1);
    expect(afterV2.places).toHaveLength(1);
    expect(afterV2.hooks).toHaveLength(1);
    expect(afterV2.threadRefs).toHaveLength(1);
  });
});
