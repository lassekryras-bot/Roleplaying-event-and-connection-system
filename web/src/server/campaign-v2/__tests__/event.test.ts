// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { Location, Session } from '@/generated/campaign-v2';
import {
  attachEventToLocation,
  attachEventToSession,
  attachEventToThread,
  createCampaignV2Event,
  createCampaignV2Session,
  resolveCampaignV2Event,
  resolveEventLocations,
  resolveEventSessions,
} from '@/server/campaign-v2';

function createLocation(): Location {
  return {
    id: 'location-brass-docks',
    type: 'location',
    campaignId: 'project-1',
    title: 'Brass Docks',
    summary: 'A fog-heavy district with restless traffic.',
    tags: ['docks'],
    relations: [],
  };
}

function createSession(): Session {
  return createCampaignV2Session({
    id: 'session-brass-docks-01',
    title: 'Smoke on the Quay',
    locationId: 'location-brass-docks',
    summary: 'The crew corners the harbor contact.',
  });
}

describe('campaign-v2 event helpers', () => {
  it('creates a minimal v2 event record', () => {
    const event = createCampaignV2Event({
      id: 'event-runner-ambush',
      title: 'Runner Ambush',
      summary: 'A courier bolts through the market with a stolen ledger.',
      status: 'available',
      eventType: 'combat-happened',
      notes: 'First-pass migrated from a hook.',
      createdEffectIds: ['effect-heightened-alert'],
    });

    expect(event).toEqual({
      id: 'event-runner-ambush',
      type: 'event',
      title: 'Runner Ambush',
      summary: 'A courier bolts through the market with a stolen ledger.',
      status: 'available',
      eventType: 'combat-happened',
      notes: 'First-pass migrated from a hook.',
      relations: [],
      createdEffectIds: ['effect-heightened-alert'],
    });
  });

  it('attaches and resolves event links for sessions and locations', () => {
    const location = createLocation();
    const session = createSession();
    const event = attachEventToThread(
      attachEventToSession(
        attachEventToLocation(
          createCampaignV2Event({
            id: 'event-sable-auctioneer',
            title: 'Sable Auctioneer',
            summary: 'The auctioneer knows who paid for silence.',
            status: 'active',
            eventType: 'npc-meeting',
          }),
          location,
        ),
        session,
      ),
      'thread-sable-creditors',
    );

    expect(event.relations).toEqual([
      { type: 'occursAt', targetId: location.id },
      { type: 'relatedTo', targetId: session.id },
      { type: 'relatedTo', targetId: 'thread-sable-creditors' },
    ]);
    expect(resolveEventLocations(event, [location])).toEqual([location]);
    expect(resolveEventSessions(event, [session])).toEqual([session]);
    expect(resolveCampaignV2Event(event, [location], [session])).toEqual({
      event,
      locations: [location],
      sessions: [session],
    });
  });
});
