import type { Effect, Event, Location, LocationState, Session } from '@/generated/campaign-v2';

import type { CampaignV2Diagnostic } from './errors';
import { formatCampaignV2Diagnostic } from './errors';
import {
  resolveCampaignV2Effect,
  resolveCampaignV2LocationEffects,
  type CampaignV2LocationEffectResolution,
} from './effect';
import { createCampaignV2RelationGraph, type CampaignV2RelationGraph } from './relations';
import { resolveCampaignV2Event } from './event';
import { resolveCampaignV2Session } from './session';

export type CampaignV2ResolverSource = {
  projectId: string;
  loadedAt?: Date | string | null;
  locations: readonly Location[];
  locationStates: readonly LocationState[];
  sessions: readonly Session[];
  events: readonly Event[];
  effects: readonly Effect[];
  diagnostics?: readonly CampaignV2Diagnostic[];
};

export type CampaignV2LocationSummaryViewModel = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  parentLocationId: string | null;
};

export type CampaignV2LocationTimelineStateEntryViewModel = {
  kind: 'locationState';
  sequence: number;
  id: string;
  title: string;
  summary: string;
  status: LocationState['status'];
  notes: string | null;
  relatedEventIds: string[];
  relatedEffectIds: string[];
};

export type CampaignV2LocationTimelineSessionEntryViewModel = {
  kind: 'session';
  sequence: number;
  id: string;
  title: string;
  summary: string;
  notes: string | null;
  locationId: string;
  locationTitle: string | null;
  startingLocationStateId: string | null;
  startingLocationStateTitle: string | null;
  resultingLocationStateId: string | null;
  resultingLocationStateTitle: string | null;
  relatedLocationIds: string[];
  relatedEventIds: string[];
  relatedEffectIds: string[];
};

export type CampaignV2LocationTimelineEntryViewModel =
  | CampaignV2LocationTimelineStateEntryViewModel
  | CampaignV2LocationTimelineSessionEntryViewModel;

export type CampaignV2EventViewModel = {
  id: string;
  title: string;
  summary: string;
  status: Event['status'];
  eventType: string | null;
  notes: string | null;
  createdEffectIds: string[];
  locationIds: string[];
  locationTitles: string[];
  sessionIds: string[];
  sessionTitles: string[];
};

export type CampaignV2EffectLocationRelevanceKind = 'local' | 'inherited' | 'modifier';

export type CampaignV2EffectLocationRelevanceViewModel = {
  locationId: string;
  locationTitle: string;
  kinds: CampaignV2EffectLocationRelevanceKind[];
};

export type CampaignV2EffectViewModel = {
  id: string;
  title: string;
  summary: string;
  status: Effect['status'];
  effectType: string | null;
  scope: Effect['scope'];
  severity: Effect['severity'];
  notes: string | null;
  modifiesEffectIds: string[];
  modifiedByEffectIds: string[];
  locationIds: string[];
  locationTitles: string[];
  relevanceByLocation: CampaignV2EffectLocationRelevanceViewModel[];
};

export type CampaignV2LocationTimelinePayload = {
  projectId: string;
  loadedAt: string | null;
  location: CampaignV2LocationSummaryViewModel;
  entries: CampaignV2LocationTimelineEntryViewModel[];
  relatedEvents: CampaignV2EventViewModel[];
  relatedEffects: CampaignV2EffectViewModel[];
  diagnosticMessages: string[];
};

export type CampaignV2OverviewSessionViewModel = {
  id: string;
  title: string;
  summary: string;
  notes: string | null;
  locationId: string;
  locationTitle: string | null;
  startingLocationStateId: string | null;
  startingLocationStateTitle: string | null;
  resultingLocationStateId: string | null;
  resultingLocationStateTitle: string | null;
  relatedEventIds: string[];
  relatedEffectIds: string[];
};

export type CampaignV2OverviewLocationReason = 'next-session' | 'session-relation' | 'event-lead';

export type CampaignV2OverviewLocationViewModel = CampaignV2LocationSummaryViewModel & {
  reasons: CampaignV2OverviewLocationReason[];
};

export type CampaignV2GmOverviewPayload = {
  projectId: string;
  loadedAt: string | null;
  previousSession: CampaignV2OverviewSessionViewModel | null;
  currentSession: CampaignV2OverviewSessionViewModel | null;
  likelyNextLocations: CampaignV2OverviewLocationViewModel[];
  relatedEvents: CampaignV2EventViewModel[];
  relatedEffects: CampaignV2EffectViewModel[];
  diagnosticMessages: string[];
};

export type CampaignV2Resolver = {
  buildLocationTimeline(locationId: string): CampaignV2LocationTimelinePayload | null;
  buildGmOverview(): CampaignV2GmOverviewPayload;
};

type CampaignV2ObjectByKind = {
  location: Location;
  locationState: LocationState;
  session: Session;
  event: Event;
  effect: Effect;
};

type CampaignV2ResolverObjectKind = keyof CampaignV2ObjectByKind;

type ResolverContext = {
  projectId: string;
  loadedAt: string | null;
  locations: Location[];
  locationStates: LocationState[];
  sessions: Session[];
  events: Event[];
  effects: Effect[];
  locationsById: Map<string, Location>;
  locationStatesById: Map<string, LocationState>;
  sessionsById: Map<string, Session>;
  eventsById: Map<string, Event>;
  effectsById: Map<string, Effect>;
  relationGraph: CampaignV2RelationGraph;
  diagnosticMessages: string[];
  orderedSessions: Session[];
  sessionFollowersById: Map<string, Session[]>;
};

const SESSION_STATUS_PRIORITY: Array<Event['status']> = ['active', 'available', 'locked', 'resolved', 'missed', 'archived'];
const LOCATION_REASON_PRIORITY: CampaignV2OverviewLocationReason[] = ['next-session', 'session-relation', 'event-lead'];
const EFFECT_RELEVANCE_PRIORITY: CampaignV2EffectLocationRelevanceKind[] = ['local', 'modifier', 'inherited'];

function normalizeLoadedAt(value: CampaignV2ResolverSource['loadedAt']) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : null;
}

function toMap<T extends { id: string }>(values: readonly T[]) {
  return new Map(values.map((value) => [value.id, value]));
}

function uniqueById<T extends { id: string }>(values: readonly T[]) {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function compareTitleAndId<T extends { id: string; title: string }>(left: T, right: T) {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function compareLocationSummary(left: CampaignV2OverviewLocationViewModel, right: CampaignV2OverviewLocationViewModel) {
  const leftRank = Math.min(...left.reasons.map((reason) => LOCATION_REASON_PRIORITY.indexOf(reason)).filter((rank) => rank >= 0));
  const rightRank = Math.min(...right.reasons.map((reason) => LOCATION_REASON_PRIORITY.indexOf(reason)).filter((rank) => rank >= 0));
  return leftRank - rightRank || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function compareEvents(left: Event, right: Event) {
  const leftRank = SESSION_STATUS_PRIORITY.indexOf(left.status);
  const rightRank = SESSION_STATUS_PRIORITY.indexOf(right.status);
  return leftRank - rightRank || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function compareSessionsForTimeline(left: Session, right: Session) {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function getSessionFollowTargets(session: Session, sessionsById: ReadonlyMap<string, Session>) {
  return (session.relations ?? [])
    .filter((relation) => relation.type === 'follows' && sessionsById.has(relation.targetId))
    .map((relation) => relation.targetId);
}

function buildOrderedSessions(sessions: readonly Session[]) {
  const sessionsById = toMap(sessions);
  const incomingCounts = new Map<string, number>();
  const followersById = new Map<string, Set<string>>();

  for (const session of sessions) {
    incomingCounts.set(session.id, 0);
    followersById.set(session.id, new Set());
  }

  for (const session of sessions) {
    for (const targetId of getSessionFollowTargets(session, sessionsById)) {
      const followers = followersById.get(targetId);
      if (!followers || followers.has(session.id)) {
        continue;
      }

      followers.add(session.id);
      incomingCounts.set(session.id, (incomingCounts.get(session.id) ?? 0) + 1);
    }
  }

  const queue = sessions
    .filter((session) => (incomingCounts.get(session.id) ?? 0) === 0)
    .slice()
    .sort(compareSessionsForTimeline);
  const ordered: Session[] = [];

  while (queue.length > 0) {
    const nextSession = queue.shift();
    if (!nextSession) {
      continue;
    }

    ordered.push(nextSession);
    const followerIds = [...(followersById.get(nextSession.id) ?? [])].sort((left, right) => {
      const leftSession = sessionsById.get(left);
      const rightSession = sessionsById.get(right);
      if (!leftSession || !rightSession) {
        return left.localeCompare(right);
      }

      return compareSessionsForTimeline(leftSession, rightSession);
    });

    for (const followerId of followerIds) {
      const remainingIncoming = (incomingCounts.get(followerId) ?? 0) - 1;
      incomingCounts.set(followerId, remainingIncoming);
      if (remainingIncoming === 0) {
        const follower = sessionsById.get(followerId);
        if (follower) {
          queue.push(follower);
          queue.sort(compareSessionsForTimeline);
        }
      }
    }
  }

  const remainingSessions = sessions
    .filter((session) => !ordered.some((candidate) => candidate.id === session.id))
    .slice()
    .sort(compareSessionsForTimeline);

  const sessionFollowersById = new Map<string, Session[]>();
  for (const [sessionId, followerIds] of followersById.entries()) {
    sessionFollowersById.set(
      sessionId,
      [...followerIds]
        .map((followerId) => sessionsById.get(followerId))
        .filter((session): session is Session => Boolean(session))
        .sort(compareSessionsForTimeline),
    );
  }

  return {
    orderedSessions: [...ordered, ...remainingSessions],
    sessionFollowersById,
  };
}

function createContext(source: CampaignV2ResolverSource): ResolverContext {
  const locations = source.locations.slice();
  const locationStates = source.locationStates.slice();
  const sessions = source.sessions.slice();
  const events = source.events.slice();
  const effects = source.effects.slice();
  const relationGraph = createCampaignV2RelationGraph({
    locations,
    locationStates,
    sessions,
    events,
    effects,
  });
  const { orderedSessions, sessionFollowersById } = buildOrderedSessions(sessions);

  return {
    projectId: source.projectId,
    loadedAt: normalizeLoadedAt(source.loadedAt),
    locations,
    locationStates,
    sessions,
    events,
    effects,
    locationsById: toMap(locations),
    locationStatesById: toMap(locationStates),
    sessionsById: toMap(sessions),
    eventsById: toMap(events),
    effectsById: toMap(effects),
    relationGraph,
    diagnosticMessages: (source.diagnostics ?? []).map((diagnostic) => formatCampaignV2Diagnostic(diagnostic)),
    orderedSessions,
    sessionFollowersById,
  };
}

function summarizeLocation(location: Location): CampaignV2LocationSummaryViewModel {
  return {
    id: location.id,
    title: location.title,
    summary: location.summary,
    tags: [...(location.tags ?? [])],
    parentLocationId: location.parentLocationId ?? null,
  };
}

function getRelatedObjectsOfType<T extends CampaignV2ResolverObjectKind>(
  context: ResolverContext,
  id: string,
  kind: T,
) {
  return context.relationGraph
    .getObjectsRelatedTo(id)
    .map((entry) => entry.object)
    .filter((object) => object.type === kind) as CampaignV2ObjectByKind[T][];
}

function getRelatedEventIds(context: ResolverContext, id: string) {
  return uniqueById(getRelatedObjectsOfType(context, id, 'event')).map((event) => event.id).sort((left, right) => left.localeCompare(right));
}

function getSessionLocationTargets(session: Session, context: ResolverContext) {
  return uniqueById(
    (session.relations ?? [])
      .map((relation) => context.locationsById.get(relation.targetId))
      .filter((location): location is Location => Boolean(location)),
  ).sort(compareTitleAndId);
}

function getSessionEffectIds(session: Session, context: ResolverContext) {
  const eventEffectIds = getRelatedObjectsOfType(context, session.id, 'event').flatMap((event) => event.createdEffectIds ?? []);
  const location = context.locationsById.get(session.locationId);
  const locationEffects = location
    ? resolveCampaignV2LocationEffects(location, context.locationsById, context.effectsById).allRelevantEffects
    : [];

  return [...new Set([...eventEffectIds, ...locationEffects.map((effect) => effect.id)])].sort((left, right) =>
    left.localeCompare(right),
  );
}

function toSessionOverviewViewModel(session: Session, context: ResolverContext): CampaignV2OverviewSessionViewModel {
  const resolvedSession = resolveCampaignV2Session(session, context.locationsById, context.locationStatesById);

  return {
    id: session.id,
    title: session.title,
    summary: session.summary,
    notes: session.notes ?? null,
    locationId: session.locationId,
    locationTitle: resolvedSession.location?.title ?? null,
    startingLocationStateId: session.startingLocationStateId ?? null,
    startingLocationStateTitle: resolvedSession.startingLocationState?.title ?? null,
    resultingLocationStateId: session.resultingLocationStateId ?? null,
    resultingLocationStateTitle: resolvedSession.resultingLocationState?.title ?? null,
    relatedEventIds: getRelatedEventIds(context, session.id),
    relatedEffectIds: getSessionEffectIds(session, context),
  };
}

function toEventViewModel(event: Event, context: ResolverContext): CampaignV2EventViewModel {
  const resolvedEvent = resolveCampaignV2Event(event, context.locationsById, context.sessionsById);

  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    status: event.status,
    eventType: event.eventType ?? null,
    notes: event.notes ?? null,
    createdEffectIds: [...(event.createdEffectIds ?? [])],
    locationIds: resolvedEvent.locations.map((location) => location.id),
    locationTitles: resolvedEvent.locations.map((location) => location.title),
    sessionIds: resolvedEvent.sessions.map((session) => session.id),
    sessionTitles: resolvedEvent.sessions.map((session) => session.title),
  };
}

function toEffectViewModel(
  effect: Effect,
  context: ResolverContext,
  relevanceByLocation: CampaignV2EffectLocationRelevanceViewModel[],
): CampaignV2EffectViewModel {
  const resolvedEffect = resolveCampaignV2Effect(effect, context.locationsById, context.effectsById);

  return {
    id: effect.id,
    title: effect.title,
    summary: effect.summary,
    status: effect.status,
    effectType: effect.effectType ?? null,
    scope: effect.scope ?? null,
    severity: effect.severity ?? null,
    notes: effect.notes ?? null,
    modifiesEffectIds: resolvedEffect.modifies.map((item) => item.id),
    modifiedByEffectIds: resolvedEffect.modifiedBy.map((item) => item.id),
    locationIds: relevanceByLocation.map((entry) => entry.locationId),
    locationTitles: relevanceByLocation.map((entry) => entry.locationTitle),
    relevanceByLocation,
  };
}

function buildEffectViewModelsForLocations(
  context: ResolverContext,
  resolutions: CampaignV2LocationEffectResolution[],
) {
  const locationOrderById = new Map(resolutions.map((resolution, index) => [resolution.location.id, index]));
  const effectsById = new Map<
    string,
    {
      effect: Effect;
      relevanceByLocation: Map<string, CampaignV2EffectLocationRelevanceViewModel>;
    }
  >();

  for (const resolution of resolutions) {
    const addEffect = (effect: Effect, kind: CampaignV2EffectLocationRelevanceKind) => {
      const existing = effectsById.get(effect.id) ?? {
        effect,
        relevanceByLocation: new Map<string, CampaignV2EffectLocationRelevanceViewModel>(),
      };
      const existingLocationEntry = existing.relevanceByLocation.get(resolution.location.id) ?? {
        locationId: resolution.location.id,
        locationTitle: resolution.location.title,
        kinds: [],
      };

      if (!existingLocationEntry.kinds.includes(kind)) {
        existingLocationEntry.kinds.push(kind);
        existingLocationEntry.kinds.sort(
          (left, right) => EFFECT_RELEVANCE_PRIORITY.indexOf(left) - EFFECT_RELEVANCE_PRIORITY.indexOf(right),
        );
      }

      existing.relevanceByLocation.set(resolution.location.id, existingLocationEntry);
      effectsById.set(effect.id, existing);
    };

    for (const effect of resolution.localEffects) {
      addEffect(effect, 'local');
    }

    for (const effect of resolution.inheritedEffects) {
      addEffect(effect, 'inherited');
    }

    for (const effect of resolution.localModifiersOfInherited) {
      addEffect(effect, 'modifier');
    }
  }

  return [...effectsById.values()]
    .map(({ effect, relevanceByLocation }) =>
      toEffectViewModel(
        effect,
        context,
        [...relevanceByLocation.values()].sort((left, right) => left.locationTitle.localeCompare(right.locationTitle)),
      ),
    )
    .sort((left, right) => {
      const leftLocationOrder = Math.min(
        ...left.locationIds.map((locationId) => locationOrderById.get(locationId) ?? Number.POSITIVE_INFINITY),
      );
      const rightLocationOrder = Math.min(
        ...right.locationIds.map((locationId) => locationOrderById.get(locationId) ?? Number.POSITIVE_INFINITY),
      );
      const leftRelevanceRank = Math.min(
        ...left.relevanceByLocation
          .flatMap((entry) => entry.kinds)
          .map((kind) => EFFECT_RELEVANCE_PRIORITY.indexOf(kind))
          .filter((rank) => rank >= 0),
      );
      const rightRelevanceRank = Math.min(
        ...right.relevanceByLocation
          .flatMap((entry) => entry.kinds)
          .map((kind) => EFFECT_RELEVANCE_PRIORITY.indexOf(kind))
          .filter((rank) => rank >= 0),
      );

      return (
        leftLocationOrder - rightLocationOrder ||
        leftRelevanceRank - rightRelevanceRank ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id)
      );
    });
}

function isInitialLikeState(locationState: LocationState) {
  return (
    locationState.id.endsWith('-initial') ||
    locationState.title.toLowerCase().includes('before visit') ||
    locationState.title.toLowerCase().includes('initial state')
  );
}

function isSessionRelatedToLocation(session: Session, locationId: string, locationStateIds: Set<string>) {
  return (
    session.locationId === locationId ||
    (session.startingLocationStateId ? locationStateIds.has(session.startingLocationStateId) : false) ||
    (session.resultingLocationStateId ? locationStateIds.has(session.resultingLocationStateId) : false) ||
    (session.relations ?? []).some((relation) => relation.targetId === locationId)
  );
}

function buildLocationTimelineEntries(
  context: ResolverContext,
  location: Location,
  locationStates: LocationState[],
  sessions: Session[],
  relatedEffectIds: string[],
) {
  const resultingStateIds = new Set(sessions.map((session) => session.resultingLocationStateId).filter((id): id is string => Boolean(id)));
  const rootStates = locationStates
    .filter((locationState) => !resultingStateIds.has(locationState.id))
    .slice()
    .sort((left, right) => Number(isInitialLikeState(right)) - Number(isInitialLikeState(left)) || compareTitleAndId(left, right));
  const orderedStateIds = new Set<string>();
  const entries: CampaignV2LocationTimelineEntryViewModel[] = [];
  let sequence = 1;

  const pushState = (locationState: LocationState) => {
    if (orderedStateIds.has(locationState.id)) {
      return;
    }

    orderedStateIds.add(locationState.id);
    entries.push({
      kind: 'locationState',
      sequence,
      id: locationState.id,
      title: locationState.title,
      summary: locationState.summary,
      status: locationState.status,
      notes: locationState.notes ?? null,
      relatedEventIds: getRelatedEventIds(context, locationState.id),
      relatedEffectIds,
    });
    sequence += 1;
  };

  for (const rootState of rootStates) {
    pushState(rootState);
  }

  for (const session of sessions) {
    const resolvedSession = resolveCampaignV2Session(session, context.locationsById, context.locationStatesById);

    if (resolvedSession.startingLocationState) {
      pushState(resolvedSession.startingLocationState);
    }

    entries.push({
      kind: 'session',
      sequence,
      id: session.id,
      title: session.title,
      summary: session.summary,
      notes: session.notes ?? null,
      locationId: session.locationId,
      locationTitle: resolvedSession.location?.title ?? null,
      startingLocationStateId: session.startingLocationStateId ?? null,
      startingLocationStateTitle: resolvedSession.startingLocationState?.title ?? null,
      resultingLocationStateId: session.resultingLocationStateId ?? null,
      resultingLocationStateTitle: resolvedSession.resultingLocationState?.title ?? null,
      relatedLocationIds: getSessionLocationTargets(session, context).map((item) => item.id),
      relatedEventIds: getRelatedEventIds(context, session.id),
      relatedEffectIds: getSessionEffectIds(session, context),
    });
    sequence += 1;

    if (resolvedSession.resultingLocationState) {
      pushState(resolvedSession.resultingLocationState);
    }
  }

  for (const locationState of locationStates.slice().sort((left, right) => compareTitleAndId(left, right))) {
    pushState(locationState);
  }

  return entries;
}

function collectLocationTimelineEvents(
  context: ResolverContext,
  location: Location,
  locationStates: LocationState[],
  sessions: Session[],
) {
  const relatedEvents = uniqueById(
    [
      ...getRelatedObjectsOfType(context, location.id, 'event'),
      ...locationStates.flatMap((locationState) => getRelatedObjectsOfType(context, locationState.id, 'event')),
      ...sessions.flatMap((session) => getRelatedObjectsOfType(context, session.id, 'event')),
    ].sort(compareEvents),
  );

  return relatedEvents.map((event) => toEventViewModel(event, context));
}

function resolveCurrentSession(context: ResolverContext) {
  const activeRelatedSessionIds = new Set(
    context.events
      .filter((event) => event.status === 'active')
      .flatMap((event) => resolveCampaignV2Event(event, context.locationsById, context.sessionsById).sessions)
      .map((session) => session.id),
  );

  if (activeRelatedSessionIds.size > 0) {
    return context.orderedSessions.find((session) => activeRelatedSessionIds.has(session.id)) ?? null;
  }

  return context.orderedSessions.at(-1) ?? null;
}

function buildLikelyNextLocations(context: ResolverContext, currentSession: Session | null) {
  if (!currentSession) {
    return [];
  }

  const locationMap = new Map<
    string,
    {
      location: Location;
      reasons: Set<CampaignV2OverviewLocationReason>;
    }
  >();

  const addLocation = (location: Location | null | undefined, reason: CampaignV2OverviewLocationReason) => {
    if (!location || location.id === currentSession.locationId) {
      return;
    }

    const existing = locationMap.get(location.id) ?? {
      location,
      reasons: new Set<CampaignV2OverviewLocationReason>(),
    };
    existing.reasons.add(reason);
    locationMap.set(location.id, existing);
  };

  for (const nextSession of context.sessionFollowersById.get(currentSession.id) ?? []) {
    addLocation(context.locationsById.get(nextSession.locationId), 'next-session');
  }

  for (const relatedLocation of getSessionLocationTargets(currentSession, context)) {
    addLocation(relatedLocation, 'session-relation');
  }

  for (const event of getRelatedObjectsOfType(context, currentSession.id, 'event')) {
    const resolvedEvent = resolveCampaignV2Event(event, context.locationsById, context.sessionsById);
    for (const location of resolvedEvent.locations) {
      addLocation(location, 'event-lead');
    }
  }

  return [...locationMap.values()]
    .map(({ location, reasons }) => ({
      ...summarizeLocation(location),
      reasons: [...reasons].sort(
        (left, right) => LOCATION_REASON_PRIORITY.indexOf(left) - LOCATION_REASON_PRIORITY.indexOf(right),
      ),
    }))
    .sort(compareLocationSummary);
}

function buildOverviewEvents(
  context: ResolverContext,
  currentSession: Session | null,
  likelyNextLocations: CampaignV2OverviewLocationViewModel[],
) {
  if (!currentSession) {
    return [];
  }

  const relatedEvents = uniqueById(
    [
      ...getRelatedObjectsOfType(context, currentSession.id, 'event'),
      ...getRelatedObjectsOfType(context, currentSession.locationId, 'event'),
      ...likelyNextLocations.flatMap((location) => getRelatedObjectsOfType(context, location.id, 'event')),
    ].sort(compareEvents),
  );

  return relatedEvents.map((event) => toEventViewModel(event, context));
}

function buildOverviewEffects(
  context: ResolverContext,
  currentSession: Session | null,
  likelyNextLocations: CampaignV2OverviewLocationViewModel[],
) {
  if (!currentSession) {
    return [];
  }

  const locations = [
    context.locationsById.get(currentSession.locationId),
    ...likelyNextLocations.map((location) => context.locationsById.get(location.id) ?? null),
  ].filter((location): location is Location => Boolean(location));
  const resolutions = locations.map((location) => resolveCampaignV2LocationEffects(location, context.locationsById, context.effectsById));

  return buildEffectViewModelsForLocations(context, resolutions);
}

function buildLocationTimeline(context: ResolverContext, locationId: string): CampaignV2LocationTimelinePayload | null {
  const location = context.locationsById.get(locationId);
  if (!location) {
    return null;
  }

  const locationStates = context.locationStates
    .filter((locationState) => locationState.locationId === locationId)
    .slice()
    .sort(compareTitleAndId);
  const locationStateIds = new Set(locationStates.map((locationState) => locationState.id));
  const sessions = context.orderedSessions.filter((session) => isSessionRelatedToLocation(session, locationId, locationStateIds));
  const effectResolution = resolveCampaignV2LocationEffects(location, context.locationsById, context.effectsById);
  const relatedEffects = buildEffectViewModelsForLocations(context, [effectResolution]);
  const relatedEffectIds = relatedEffects.map((effect) => effect.id);

  return {
    projectId: context.projectId,
    loadedAt: context.loadedAt,
    location: summarizeLocation(location),
    entries: buildLocationTimelineEntries(context, location, locationStates, sessions, relatedEffectIds),
    relatedEvents: collectLocationTimelineEvents(context, location, locationStates, sessions),
    relatedEffects,
    diagnosticMessages: [...context.diagnosticMessages],
  };
}

function buildGmOverview(context: ResolverContext): CampaignV2GmOverviewPayload {
  const currentSession = resolveCurrentSession(context);
  const currentSessionIndex = currentSession
    ? context.orderedSessions.findIndex((session) => session.id === currentSession.id)
    : -1;
  const previousSession = currentSessionIndex > 0 ? context.orderedSessions[currentSessionIndex - 1] : null;
  const likelyNextLocations = buildLikelyNextLocations(context, currentSession);
  const relatedEvents = buildOverviewEvents(context, currentSession, likelyNextLocations);
  const relatedEffects = buildOverviewEffects(context, currentSession, likelyNextLocations);

  return {
    projectId: context.projectId,
    loadedAt: context.loadedAt,
    previousSession: previousSession ? toSessionOverviewViewModel(previousSession, context) : null,
    currentSession: currentSession ? toSessionOverviewViewModel(currentSession, context) : null,
    likelyNextLocations,
    relatedEvents,
    relatedEffects,
    diagnosticMessages: [...context.diagnosticMessages],
  };
}

export function createCampaignV2Resolver(source: CampaignV2ResolverSource): CampaignV2Resolver {
  const context = createContext(source);

  return {
    buildLocationTimeline(locationId) {
      return buildLocationTimeline(context, locationId);
    },
    buildGmOverview() {
      return buildGmOverview(context);
    },
  };
}

export function buildCampaignV2LocationTimeline(source: CampaignV2ResolverSource, locationId: string) {
  return createCampaignV2Resolver(source).buildLocationTimeline(locationId);
}

export function buildCampaignV2GmOverview(source: CampaignV2ResolverSource) {
  return createCampaignV2Resolver(source).buildGmOverview();
}
