import type { Location, LocationState, Relation } from '@/generated/campaign-v2';

import { normalizeCampaignV2Relations } from './relations';

export type CampaignV2LocationStateStage = 'initial' | 'post-major-visit';

export type CampaignV2LinkedLocationState = {
  location: Location;
  locationState: LocationState;
};

type CreateLocationStateBaseOptions = {
  id?: string;
  notes?: string | null;
  relations?: Relation[];
  title?: string;
};

export type CreateInitialLocationStateOptions = CreateLocationStateBaseOptions & {
  status?: LocationState['status'];
  summary?: string;
};

export type CreatePostMajorVisitLocationStateOptions = CreateLocationStateBaseOptions & {
  status?: LocationState['status'];
  summary: string;
};

function isLocationMap(
  locations: readonly Location[] | ReadonlyMap<string, Location>,
): locations is ReadonlyMap<string, Location> {
  return !Array.isArray(locations);
}

function stripLocationPrefix(locationId: string) {
  return locationId.replace(/^location-/, '');
}

export function createLocationStateId(locationId: string, stage: CampaignV2LocationStateStage) {
  return `location-state-${stripLocationPrefix(locationId)}-${stage}`;
}

function createLocationStateRecord(
  location: Location,
  stage: CampaignV2LocationStateStage,
  {
    id,
    notes,
    relations,
    status,
    summary,
    title,
  }: {
    id?: string;
    notes?: string | null;
    relations?: Relation[];
    status?: LocationState['status'];
    summary: string;
    title?: string;
  },
): LocationState {
  return {
    id: id ?? createLocationStateId(location.id, stage),
    type: 'locationState',
    locationId: location.id,
    title: title ?? `${location.title} ${stage === 'initial' ? 'Before Visit' : 'After Major Visit'}`,
    summary,
    status: status ?? (stage === 'initial' ? 'available' : 'active'),
    notes,
    relations: normalizeCampaignV2Relations(relations),
  };
}

export function createInitialLocationState(location: Location, options: CreateInitialLocationStateOptions = {}): LocationState {
  return createLocationStateRecord(location, 'initial', {
    ...options,
    summary: options.summary ?? location.summary,
  });
}

export function createPostMajorVisitLocationState(
  location: Location,
  options: CreatePostMajorVisitLocationStateOptions,
): LocationState {
  return createLocationStateRecord(location, 'post-major-visit', options);
}

export function isLocationStateForLocation(
  locationState: Pick<LocationState, 'locationId'>,
  locationOrId: Pick<Location, 'id'> | string,
) {
  const locationId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
  return locationState.locationId === locationId;
}

export function resolveLocationForState(
  locationState: Pick<LocationState, 'locationId'>,
  locations: readonly Location[] | ReadonlyMap<string, Location>,
) {
  if (isLocationMap(locations)) {
    return locations.get(locationState.locationId) ?? null;
  }

  return locations.find((location) => location.id === locationState.locationId) ?? null;
}

export function linkLocationStateToLocation(
  locationState: LocationState,
  location: Location,
): CampaignV2LinkedLocationState {
  if (!isLocationStateForLocation(locationState, location)) {
    throw new Error(`Location state ${locationState.id} does not belong to location ${location.id}.`);
  }

  return {
    location,
    locationState,
  };
}
