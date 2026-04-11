// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { Location } from '@/generated/campaign-v2';
import {
  createCampaignV2Session,
  createInitialLocationState,
  createPostMajorVisitLocationState,
  resolveCampaignV2Session,
  resolveSessionLocation,
  resolveSessionResultingState,
  resolveSessionStartingState,
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

describe('campaign-v2 session helpers', () => {
  it('creates a minimal v2 session record', () => {
    const session = createCampaignV2Session({
      id: 'session-brass-docks-01',
      title: 'Smoke on the Quay',
      locationId: 'location-brass-docks',
      summary: 'The crew corners the harbor contact.',
      notes: 'Imported from a legacy timeline session.',
      relations: [{ type: 'follows', targetId: 'session-brass-docks-00' }],
    });

    expect(session).toEqual({
      id: 'session-brass-docks-01',
      type: 'session',
      title: 'Smoke on the Quay',
      locationId: 'location-brass-docks',
      summary: 'The crew corners the harbor contact.',
      notes: 'Imported from a legacy timeline session.',
      relations: [{ type: 'follows', targetId: 'session-brass-docks-00' }],
      startingLocationStateId: null,
      resultingLocationStateId: null,
    });
  });

  it('resolves a session to its location and state transition', () => {
    const location = createLocation();
    const startingLocationState = createInitialLocationState(location);
    const resultingLocationState = createPostMajorVisitLocationState(location, {
      summary: 'The docks tighten after the showdown.',
    });
    const session = createCampaignV2Session({
      id: 'session-brass-docks-01',
      title: 'Smoke on the Quay',
      locationId: location.id,
      summary: 'The crew corners the harbor contact.',
      startingLocationStateId: startingLocationState.id,
      resultingLocationStateId: resultingLocationState.id,
    });

    expect(resolveSessionLocation(session, [location])).toEqual(location);
    expect(resolveSessionStartingState(session, [startingLocationState, resultingLocationState])).toEqual(startingLocationState);
    expect(resolveSessionResultingState(session, [startingLocationState, resultingLocationState])).toEqual(resultingLocationState);
    expect(resolveCampaignV2Session(session, [location], [startingLocationState, resultingLocationState])).toEqual({
      session,
      location,
      startingLocationState,
      resultingLocationState,
    });
  });
});
