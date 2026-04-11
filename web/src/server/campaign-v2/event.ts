import type { Event, Location, Relation, Session } from '@/generated/campaign-v2';

import { normalizeCampaignV2Relations } from './relations';

type LocationCollection = readonly Location[] | ReadonlyMap<string, Location>;
type SessionCollection = readonly Session[] | ReadonlyMap<string, Session>;

export type CreateCampaignV2EventOptions = {
  id: string;
  title: string;
  summary: string;
  status: Event['status'];
  notes?: string | null;
  relations?: Relation[];
  eventType?: string | null;
  createdEffectIds?: string[] | null;
};

export type CampaignV2ResolvedEvent = {
  event: Event;
  locations: Location[];
  sessions: Session[];
};

function isLocationMap(locations: LocationCollection): locations is ReadonlyMap<string, Location> {
  return !Array.isArray(locations);
}

function isSessionMap(sessions: SessionCollection): sessions is ReadonlyMap<string, Session> {
  return !Array.isArray(sessions);
}

function uniqueNonEmpty(values: readonly string[] | null | undefined) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

function appendEventRelation(event: Event, relation: Relation): Event {
  return {
    ...event,
    relations: normalizeCampaignV2Relations([...(event.relations ?? []), relation]),
  };
}

function resolveTargetsByRelationIds<T extends { id: string }>(
  event: Pick<Event, 'relations'>,
  collection: readonly T[] | ReadonlyMap<string, T>,
) {
  const targetIds = uniqueNonEmpty((event.relations ?? []).map((relation) => relation.targetId));

  if (Array.isArray(collection)) {
    const targetsById = new Map(collection.map((target) => [target.id, target]));
    return targetIds.map((targetId) => targetsById.get(targetId)).filter((target): target is T => Boolean(target));
  }

  const targetsById = collection as ReadonlyMap<string, T>;
  return targetIds.map((targetId) => targetsById.get(targetId)).filter((target): target is T => Boolean(target));
}

export function createCampaignV2Event({
  createdEffectIds,
  eventType,
  id,
  notes,
  relations,
  status,
  summary,
  title,
}: CreateCampaignV2EventOptions): Event {
  return {
    id,
    type: 'event',
    title,
    summary,
    status,
    notes: notes ?? null,
    relations: normalizeCampaignV2Relations(relations),
    eventType: eventType ?? null,
    createdEffectIds: uniqueNonEmpty(createdEffectIds),
  };
}

export function attachEventToSession(event: Event, sessionOrId: string | Pick<Session, 'id'>) {
  const targetId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
  return appendEventRelation(event, {
    type: 'relatedTo',
    targetId,
  });
}

export function attachEventToLocation(
  event: Event,
  locationOrId: string | Pick<Location, 'id'>,
  relationType: 'occursAt' | 'involves' = 'occursAt',
) {
  const targetId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
  return appendEventRelation(event, {
    type: relationType,
    targetId,
  });
}

export function attachEventToThread(event: Event, threadId: string) {
  return appendEventRelation(event, {
    type: 'relatedTo',
    targetId: threadId,
  });
}

export function resolveEventLocations(event: Pick<Event, 'relations'>, locations: LocationCollection) {
  if (isLocationMap(locations)) {
    return resolveTargetsByRelationIds(event, locations);
  }

  return resolveTargetsByRelationIds(event, locations);
}

export function resolveEventSessions(event: Pick<Event, 'relations'>, sessions: SessionCollection) {
  if (isSessionMap(sessions)) {
    return resolveTargetsByRelationIds(event, sessions);
  }

  return resolveTargetsByRelationIds(event, sessions);
}

export function resolveCampaignV2Event(
  event: Event,
  locations: LocationCollection,
  sessions: SessionCollection,
): CampaignV2ResolvedEvent {
  return {
    event,
    locations: resolveEventLocations(event, locations),
    sessions: resolveEventSessions(event, sessions),
  };
}
