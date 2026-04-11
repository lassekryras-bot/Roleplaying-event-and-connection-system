// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { applyCampaignV2AuthoringAction, createCampaignV2Store } from '@/server/campaign-v2';

const repoRoot = path.resolve(fileURLToPath(new URL('../../../../../', import.meta.url)));
const campaignV2SchemaRoot = path.join(repoRoot, 'schemas', 'campaign-v2');
const projectId = 'project-fixture';

const tempDirectories: string[] = [];

async function writeJsonFile(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-v2-authoring-'));
  tempDirectories.push(root);

  return {
    root,
    campaignsRoot: path.join(root, 'campaigns'),
  };
}

async function seedProject(campaignsRoot: string) {
  await writeJsonFile(path.join(campaignsRoot, projectId, 'project.json'), {
    id: projectId,
    name: 'Fixture Project',
    status: 'active',
  });
}

async function seedBaseLocation(campaignsRoot: string) {
  await writeJsonFile(path.join(campaignsRoot, projectId, 'campaign-v2', 'locations', 'location-alkenstar.json'), {
    id: 'location-alkenstar',
    type: 'location',
    campaignId: projectId,
    title: 'Alkenstar',
    summary: 'A smoke-choked city.',
    tags: ['city'],
    parentLocationId: null,
    relations: [],
  });
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('campaign-v2 authoring', () => {
  it('creates guided v2 objects directly in the primary dataset', async () => {
    const workspace = await createWorkspace();
    await seedProject(workspace.campaignsRoot);
    await seedBaseLocation(workspace.campaignsRoot);

    const createdLocation = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertLocation',
        title: 'Barrel & Bullet Saloon',
        summary: 'A dependable safehouse and meeting ground.',
        tags: ['saloon', 'safehouse'],
        parentLocationId: 'location-alkenstar',
      },
    });

    const createdLocationState = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertLocationState',
        locationId: createdLocation.entityId,
        stage: 'initial',
        title: 'Barrel & Bullet Before Visit',
        summary: 'The crew can still move quietly through the saloon.',
        status: 'available',
        notes: 'Foebe is willing to help for the right favor.',
      },
    });

    const createdSession = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertSession',
        locationId: createdLocation.entityId,
        title: 'First Night in the Saloon',
        summary: 'The party meets Foebe and starts feeling out local pressure.',
        notes: 'Use this as the first grounded Alkenstar session.',
        startingLocationStateId: createdLocationState.entityId,
      },
    });

    const createdEffect = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertEffect',
        locationId: createdLocation.entityId,
        title: 'Heightened Watch at the Door',
        summary: 'Foebe has doubled the lookouts after Mugland pressure.',
        status: 'active',
        effectType: 'pressure',
        scope: 'local',
        severity: 'medium',
        notes: 'Regulars notice new faces immediately.',
      },
    });

    const createdEvent = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertEvent',
        locationId: createdLocation.entityId,
        sessionId: createdSession.entityId,
        title: 'Foebe Offers a Job',
        summary: 'Foebe points the party toward a Mugland courier route.',
        status: 'active',
        eventType: 'hook-progressed',
        threadId: 'thread-mugland-courier-route',
        notes: 'This is the clean starting event for the saloon workflow.',
      },
    });

    expect(createdLocation.action).toBe('created');
    expect(createdLocationState.action).toBe('created');
    expect(createdSession.action).toBe('created');
    expect(createdEffect.action).toBe('created');
    expect(createdEvent.action).toBe('created');

    const store = await createCampaignV2Store({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
    });
    const snapshot = store.getSnapshot();

    expect(snapshot.locations.map((entry) => entry.id)).toContain(createdLocation.entityId);
    expect(snapshot.locationStates.map((entry) => entry.id)).toContain(createdLocationState.entityId);
    expect(snapshot.sessions.map((entry) => entry.id)).toContain(createdSession.entityId);
    expect(snapshot.events.map((entry) => entry.id)).toContain(createdEvent.entityId);
    expect(snapshot.effects.map((entry) => entry.id)).toContain(createdEffect.entityId);

    const session = store.getSession(createdSession.entityId);
    expect(session?.startingLocationStateId).toBe(createdLocationState.entityId);

    const event = store.getEvent(createdEvent.entityId);
    expect(event?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'occursAt', targetId: createdLocation.entityId }),
        expect.objectContaining({ type: 'relatedTo', targetId: createdSession.entityId }),
        expect.objectContaining({ type: 'relatedTo', targetId: 'thread-mugland-courier-route' }),
      ]),
    );

    const effect = store.getEffect(createdEffect.entityId);
    expect(effect?.relations).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'appliesTo', targetId: createdLocation.entityId })]),
    );
  });

  it('rejects shadow writes and mismatched session state links', async () => {
    const workspace = await createWorkspace();
    await seedProject(workspace.campaignsRoot);
    await seedBaseLocation(workspace.campaignsRoot);

    await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertLocation',
        title: 'Clockwork Yard',
        summary: 'A second district fixture.',
        tags: ['yard'],
        parentLocationId: 'location-alkenstar',
      },
    });

    const foreignState = await applyCampaignV2AuthoringAction({
      campaignsRoot: workspace.campaignsRoot,
      schemaRoot: campaignV2SchemaRoot,
      projectId,
      input: {
        action: 'upsertLocationState',
        locationId: 'location-clockwork-yard',
        stage: 'initial',
        title: 'Clockwork Yard Before Visit',
        summary: 'The yard is still locked down.',
        status: 'available',
      },
    });

    await expect(
      applyCampaignV2AuthoringAction({
        campaignsRoot: workspace.campaignsRoot,
        schemaRoot: campaignV2SchemaRoot,
        projectId,
        input: {
          action: 'upsertSession',
          locationId: 'location-alkenstar',
          title: 'Bad Link Session',
          summary: 'This should fail.',
          startingLocationStateId: foreignState.entityId,
        },
      }),
    ).rejects.toThrow('does not belong to location');

    await expect(
      applyCampaignV2AuthoringAction({
        campaignsRoot: workspace.campaignsRoot,
        schemaRoot: campaignV2SchemaRoot,
        projectId,
        contentSubdir: 'campaign-v2-shadow',
        input: {
          action: 'upsertLocation',
          title: 'Shadow Write',
          summary: 'This should be blocked.',
          tags: ['shadow'],
        },
      }),
    ).rejects.toThrow('primary campaign-v2 dataset');
  });
});
