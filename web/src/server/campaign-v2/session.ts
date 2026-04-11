import type { Location, LocationState, Relation, Session } from '@/generated/campaign-v2';

import { normalizeCampaignV2Relations } from './relations';

type LocationCollection = readonly Location[] | ReadonlyMap<string, Location>;
type LocationStateCollection = readonly LocationState[] | ReadonlyMap<string, LocationState>;

export type CreateCampaignV2SessionOptions = {
  id: string;
  title: string;
  locationId: string;
  summary: string;
  notes?: string | null;
  relations?: Relation[];
  startingLocationStateId?: string | null;
  resultingLocationStateId?: string | null;
};

export type CampaignV2ResolvedSession = {
  session: Session;
  location: Location | null;
  startingLocationState: LocationState | null;
  resultingLocationState: LocationState | null;
};

function isLocationMap(locations: LocationCollection): locations is ReadonlyMap<string, Location> {
  return !Array.isArray(locations);
}

function isLocationStateMap(
  locationStates: LocationStateCollection,
): locationStates is ReadonlyMap<string, LocationState> {
  return !Array.isArray(locationStates);
}

export function createCampaignV2Session({
  id,
  locationId,
  notes,
  relations,
  resultingLocationStateId,
  startingLocationStateId,
  summary,
  title,
}: CreateCampaignV2SessionOptions): Session {
  return {
    id,
    type: 'session',
    title,
    locationId,
    summary,
    notes,
    relations: normalizeCampaignV2Relations(relations),
    startingLocationStateId: startingLocationStateId ?? null,
    resultingLocationStateId: resultingLocationStateId ?? null,
  };
}

export function resolveSessionLocation(session: Pick<Session, 'locationId'>, locations: LocationCollection) {
  if (isLocationMap(locations)) {
    return locations.get(session.locationId) ?? null;
  }

  return locations.find((location) => location.id === session.locationId) ?? null;
}

export function resolveSessionStartingState(
  session: Pick<Session, 'startingLocationStateId'>,
  locationStates: LocationStateCollection,
) {
  if (!session.startingLocationStateId) {
    return null;
  }

  if (isLocationStateMap(locationStates)) {
    return locationStates.get(session.startingLocationStateId) ?? null;
  }

  return locationStates.find((locationState) => locationState.id === session.startingLocationStateId) ?? null;
}

export function resolveSessionResultingState(
  session: Pick<Session, 'resultingLocationStateId'>,
  locationStates: LocationStateCollection,
) {
  if (!session.resultingLocationStateId) {
    return null;
  }

  if (isLocationStateMap(locationStates)) {
    return locationStates.get(session.resultingLocationStateId) ?? null;
  }

  return locationStates.find((locationState) => locationState.id === session.resultingLocationStateId) ?? null;
}

export function resolveCampaignV2Session(
  session: Session,
  locations: LocationCollection,
  locationStates: LocationStateCollection,
): CampaignV2ResolvedSession {
  return {
    session,
    location: resolveSessionLocation(session, locations),
    startingLocationState: resolveSessionStartingState(session, locationStates),
    resultingLocationState: resolveSessionResultingState(session, locationStates),
  };
}
