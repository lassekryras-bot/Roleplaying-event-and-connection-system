// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { Location } from '@/generated/campaign-v2';
import {
  createInitialLocationState,
  createLocationStateId,
  createPostMajorVisitLocationState,
  isLocationStateForLocation,
  linkLocationStateToLocation,
  resolveLocationForState,
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

describe('campaign-v2 locationState helpers', () => {
  it('creates an initial state from a stable location', () => {
    const location = createLocation();
    const initialState = createInitialLocationState(location, {
      notes: 'Use before the first major visit.',
    });

    expect(createLocationStateId(location.id, 'initial')).toBe('location-state-brass-docks-initial');
    expect(initialState).toEqual({
      id: 'location-state-brass-docks-initial',
      type: 'locationState',
      locationId: 'location-brass-docks',
      title: 'Brass Docks Before Visit',
      summary: 'A fog-heavy district with restless traffic.',
      status: 'available',
      notes: 'Use before the first major visit.',
      relations: [],
    });
  });

  it('creates a post-major-visit state as a separate v2 object', () => {
    const location = createLocation();
    const changedState = createPostMajorVisitLocationState(location, {
      summary: 'The docks are tense and patrolled after the union confrontation.',
      notes: 'Use after the harbor showdown.',
    });

    expect(createLocationStateId(location.id, 'post-major-visit')).toBe('location-state-brass-docks-post-major-visit');
    expect(changedState).toEqual({
      id: 'location-state-brass-docks-post-major-visit',
      type: 'locationState',
      locationId: 'location-brass-docks',
      title: 'Brass Docks After Major Visit',
      summary: 'The docks are tense and patrolled after the union confrontation.',
      status: 'active',
      notes: 'Use after the harbor showdown.',
      relations: [],
    });
  });

  it('links a locationState back to its parent location', () => {
    const location = createLocation();
    const initialState = createInitialLocationState(location);

    expect(isLocationStateForLocation(initialState, location)).toBe(true);
    expect(resolveLocationForState(initialState, [location])).toEqual(location);
    expect(linkLocationStateToLocation(initialState, location)).toEqual({
      location,
      locationState: initialState,
    });
  });
});
