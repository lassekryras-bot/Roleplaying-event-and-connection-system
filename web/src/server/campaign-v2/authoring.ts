import type { Effect, Event, Location, LocationState, Relation, Session } from '@/generated/campaign-v2';

import { attachEffectModifier, attachEffectToLocation, createCampaignV2Effect } from './effect';
import { attachEventToLocation, attachEventToSession, attachEventToThread, createCampaignV2Event } from './event';
import {
  createInitialLocationState,
  createLocationStateId,
  createPostMajorVisitLocationState,
  type CampaignV2LocationStateStage,
} from './location-state';
import { normalizeCampaignV2Relations } from './relations';
import { createCampaignV2Session } from './session';
import { createCampaignV2Store } from './store';
import type { CampaignV2StorageOptions } from './storage';

export type CampaignV2AuthoringOption = {
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
};

export type CampaignV2AuthoringLocationDraft = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  parentLocationId: string | null;
};

export type CampaignV2AuthoringLocationStateDraft = {
  id: string;
  locationId: string;
  title: string;
  summary: string;
  status: LocationState['status'];
  notes: string;
};

export type CampaignV2AuthoringSessionDraft = {
  id: string;
  locationId: string;
  title: string;
  summary: string;
  notes: string;
  startingLocationStateId: string | null;
  resultingLocationStateId: string | null;
  followsSessionId: string | null;
};

export type CampaignV2AuthoringEventDraft = {
  id: string;
  title: string;
  summary: string;
  status: Event['status'];
  notes: string;
  eventType: string;
  locationId: string | null;
  sessionId: string | null;
  threadId: string;
  createdEffectIds: string[];
};

export type CampaignV2AuthoringEffectDraft = {
  id: string;
  title: string;
  summary: string;
  status: Effect['status'];
  notes: string;
  effectType: string;
  scope: Effect['scope'];
  severity: Effect['severity'];
  locationId: string | null;
  modifierEffectId: string | null;
};

export type CampaignV2AuthoringPayload = {
  readOnly: boolean;
  readOnlyReason: string | null;
  selectedLocationId: string | null;
  selectedLocationTitle: string | null;
  locationOptions: CampaignV2AuthoringOption[];
  parentLocationOptions: CampaignV2AuthoringOption[];
  locationStateOptions: CampaignV2AuthoringOption[];
  sessionOptions: CampaignV2AuthoringOption[];
  followsSessionOptions: CampaignV2AuthoringOption[];
  eventOptions: CampaignV2AuthoringOption[];
  effectOptions: CampaignV2AuthoringOption[];
  modifierEffectOptions: CampaignV2AuthoringOption[];
  locationDrafts: CampaignV2AuthoringLocationDraft[];
  locationStateDrafts: CampaignV2AuthoringLocationStateDraft[];
  sessionDrafts: CampaignV2AuthoringSessionDraft[];
  eventDrafts: CampaignV2AuthoringEventDraft[];
  effectDrafts: CampaignV2AuthoringEffectDraft[];
  defaults: {
    location: {
      title: string;
      summary: string;
      tagsText: string;
      parentLocationId: string | null;
    };
    locationState: {
      stage: CampaignV2LocationStateStage;
      title: string;
      summary: string;
      status: LocationState['status'];
      notes: string;
    };
    session: {
      title: string;
      summary: string;
      notes: string;
      startingLocationStateId: string | null;
      resultingLocationStateId: string | null;
      followsSessionId: string | null;
    };
    event: {
      title: string;
      summary: string;
      status: Event['status'];
      eventType: string;
      notes: string;
      sessionId: string | null;
      threadId: string;
      createdEffectIds: string[];
    };
    effect: {
      title: string;
      summary: string;
      status: Effect['status'];
      effectType: string;
      scope: Effect['scope'];
      severity: Effect['severity'];
      notes: string;
      modifierEffectId: string | null;
    };
  };
};

export type CampaignV2AuthoringSource = {
  projectId: string;
  locations: readonly Location[];
  locationStates: readonly LocationState[];
  sessions: readonly Session[];
  events: readonly Event[];
  effects: readonly Effect[];
};

export type CampaignV2UpsertLocationAction = {
  action: 'upsertLocation';
  locationId?: string | null;
  title: string;
  summary: string;
  tags: string[];
  parentLocationId?: string | null;
};

export type CampaignV2UpsertLocationStateAction = {
  action: 'upsertLocationState';
  locationStateId?: string | null;
  locationId: string;
  stage?: CampaignV2LocationStateStage | null;
  title: string;
  summary: string;
  status: LocationState['status'];
  notes?: string | null;
};

export type CampaignV2UpsertSessionAction = {
  action: 'upsertSession';
  sessionId?: string | null;
  locationId: string;
  title: string;
  summary: string;
  notes?: string | null;
  startingLocationStateId?: string | null;
  resultingLocationStateId?: string | null;
  followsSessionId?: string | null;
};

export type CampaignV2UpsertEventAction = {
  action: 'upsertEvent';
  eventId?: string | null;
  locationId?: string | null;
  sessionId?: string | null;
  title: string;
  summary: string;
  status: Event['status'];
  notes?: string | null;
  eventType?: string | null;
  threadId?: string | null;
  createdEffectIds?: string[] | null;
};

export type CampaignV2UpsertEffectAction = {
  action: 'upsertEffect';
  effectId?: string | null;
  locationId?: string | null;
  title: string;
  summary: string;
  status: Effect['status'];
  notes?: string | null;
  effectType?: string | null;
  scope?: Effect['scope'];
  severity?: Effect['severity'];
  modifierEffectId?: string | null;
};

export type CampaignV2AuthoringAction =
  | CampaignV2UpsertLocationAction
  | CampaignV2UpsertLocationStateAction
  | CampaignV2UpsertSessionAction
  | CampaignV2UpsertEventAction
  | CampaignV2UpsertEffectAction;

export type CampaignV2AuthoringMutation = {
  action: 'created' | 'updated';
  entityKind: 'location' | 'locationState' | 'session' | 'event' | 'effect';
  entityId: string;
  entityTitle: string;
  message: string;
  selectedLocationId: string | null;
};

const PRIMARY_CONTENT_SUBDIR = 'campaign-v2';
const STATUS_LABELS = new Map<string, string>([
  ['draft', 'Draft'],
  ['available', 'Available'],
  ['active', 'Active'],
  ['resolved', 'Resolved'],
  ['inactive', 'Inactive'],
  ['locked', 'Locked'],
  ['missed', 'Missed'],
  ['archived', 'Archived'],
]);

function sortByTitle<T extends { id: string; title: string }>(left: T, right: T) {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeTags(tags: readonly string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function joinTags(tags: readonly string[]) {
  return normalizeTags(tags).join(', ');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createUniqueId(prefix: string, preferredValue: string, existingIds: ReadonlySet<string>) {
  const baseSlug = slugify(preferredValue) || 'item';
  const baseId = `${prefix}${baseSlug}`;
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function toOption<T extends { id: string; title: string }>(
  entry: T,
  subtitle: string | null,
  status: string | null = null,
): CampaignV2AuthoringOption {
  return {
    id: entry.id,
    title: entry.title,
    subtitle,
    status,
  };
}

function summarizeLocation(location: Location) {
  return toOption(location, location.summary, null);
}

function summarizeLocationState(locationState: LocationState) {
  return toOption(locationState, locationState.summary, locationState.status);
}

function summarizeSession(session: Session, locationTitle: string | null) {
  return toOption(session, locationTitle ? `${locationTitle} · ${session.summary}` : session.summary, null);
}

function summarizeEvent(event: Event) {
  return toOption(event, event.summary, event.status);
}

function summarizeEffect(effect: Effect) {
  const parts = [effect.scope ?? null, effect.severity ?? null].filter((value) => value !== null) as string[];
  return toOption(effect, effect.summary, parts.length > 0 ? parts.join(' · ') : effect.status);
}

function findSelectedLocation(source: CampaignV2AuthoringSource, requestedLocationId?: string | null) {
  return (
    (requestedLocationId ? source.locations.find((location) => location.id === requestedLocationId) : null) ??
    source.locations.slice().sort(sortByTitle)[0] ??
    null
  );
}

function getSessionsForLocation(location: Location, source: CampaignV2AuthoringSource) {
  const stateIds = new Set(
    source.locationStates.filter((locationState) => locationState.locationId === location.id).map((locationState) => locationState.id),
  );

  return source.sessions
    .filter(
      (session) =>
        session.locationId === location.id ||
        (session.startingLocationStateId ? stateIds.has(session.startingLocationStateId) : false) ||
        (session.resultingLocationStateId ? stateIds.has(session.resultingLocationStateId) : false) ||
        (session.relations ?? []).some((relation) => relation.targetId === location.id),
    )
    .slice()
    .sort(sortByTitle);
}

function getEventsForLocation(location: Location, source: CampaignV2AuthoringSource) {
  const locationStateIds = new Set(
    source.locationStates.filter((locationState) => locationState.locationId === location.id).map((locationState) => locationState.id),
  );
  const sessionIds = new Set(getSessionsForLocation(location, source).map((session) => session.id));
  const relatedTargetIds = new Set([location.id, ...locationStateIds, ...sessionIds]);

  return source.events
    .filter((event) => (event.relations ?? []).some((relation) => relatedTargetIds.has(relation.targetId)))
    .slice()
    .sort(sortByTitle);
}

function getAncestorIds(location: Location, locationsById: ReadonlyMap<string, Location>) {
  const ancestorIds: string[] = [];
  let currentId = location.parentLocationId ?? null;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    ancestorIds.push(currentId);
    currentId = locationsById.get(currentId)?.parentLocationId ?? null;
  }

  return ancestorIds;
}

function getEffectsForLocation(location: Location, source: CampaignV2AuthoringSource) {
  const locationsById = new Map(source.locations.map((entry) => [entry.id, entry]));
  const validScopeLocationIds = new Set([location.id, ...getAncestorIds(location, locationsById)]);

  return source.effects
    .filter((effect) => {
      if (effect.scope === 'city') {
        return true;
      }

      return (effect.relations ?? []).some((relation) => validScopeLocationIds.has(relation.targetId));
    })
    .slice()
    .sort(sortByTitle);
}

function getManagedThreadId(event: Event) {
  return (
    (event.relations ?? []).find((relation) => relation.type === 'relatedTo' && relation.targetId.startsWith('thread-'))?.targetId ??
    ''
  );
}

function getManagedSessionId(event: Event, sessions: readonly Session[]) {
  const sessionIds = collectSessionIds(sessions);
  return (
    (event.relations ?? []).find((relation) => relation.type === 'relatedTo' && sessionIds.has(relation.targetId))?.targetId ?? null
  );
}

function getManagedLocationId(event: Event, locations: readonly Location[]) {
  const locationIds = collectLocationIds(locations);
  return (
    (event.relations ?? []).find(
      (relation) => (relation.type === 'occursAt' || relation.type === 'involves') && locationIds.has(relation.targetId),
    )?.targetId ?? null
  );
}

function getManagedEffectLocationId(effect: Effect, locations: readonly Location[]) {
  const locationIds = collectLocationIds(locations);
  return (
    (effect.relations ?? []).find(
      (relation) => (relation.type === 'appliesTo' || relation.type === 'occursAt') && locationIds.has(relation.targetId),
    )?.targetId ?? null
  );
}

function getManagedModifierEffectId(effect: Effect, effects: readonly Effect[]) {
  const effectIds = collectEffectIds(effects);
  return (effect.relations ?? []).find((relation) => relation.type === 'modifies' && effectIds.has(relation.targetId))?.targetId ?? null;
}

function getFollowsSessionId(session: Session) {
  return (session.relations ?? []).find((relation) => relation.type === 'follows')?.targetId ?? null;
}

function createAuthoringDefaults(selectedLocation: Location | null, source: CampaignV2AuthoringSource) {
  const locationStates = selectedLocation
    ? source.locationStates.filter((locationState) => locationState.locationId === selectedLocation.id).slice().sort(sortByTitle)
    : [];
  const sessions = selectedLocation ? getSessionsForLocation(selectedLocation, source) : [];
  const effects = selectedLocation ? getEffectsForLocation(selectedLocation, source) : [];
  const latestSession = sessions.at(-1) ?? null;

  return {
    location: {
      title: selectedLocation ? `${selectedLocation.title} Child Location` : '',
      summary: selectedLocation ? `A new playable location tied to ${selectedLocation.title}.` : '',
      tagsText: selectedLocation ? joinTags(selectedLocation.tags ?? []) : '',
      parentLocationId: selectedLocation?.id ?? null,
    },
    locationState: {
      stage: 'initial' as const,
      title: selectedLocation ? `${selectedLocation.title} Before Visit` : '',
      summary: selectedLocation?.summary ?? '',
      status: 'available' as const,
      notes: '',
    },
    session: {
      title: selectedLocation ? `Visit ${selectedLocation.title}` : '',
      summary: selectedLocation ? `A new play session anchored at ${selectedLocation.title}.` : '',
      notes: '',
      startingLocationStateId: locationStates[0]?.id ?? null,
      resultingLocationStateId: locationStates.at(-1)?.id ?? null,
      followsSessionId: latestSession?.id ?? null,
    },
    event: {
      title: selectedLocation ? `Scene at ${selectedLocation.title}` : '',
      summary: selectedLocation ? `A discrete gameplay change tied to ${selectedLocation.title}.` : '',
      status: 'active' as const,
      eventType: 'hook-progressed',
      notes: '',
      sessionId: latestSession?.id ?? null,
      threadId: '',
      createdEffectIds: [],
    },
    effect: {
      title: selectedLocation ? `Pressure at ${selectedLocation.title}` : '',
      summary: selectedLocation ? `An ongoing pressure or condition centered on ${selectedLocation.title}.` : '',
      status: 'active' as const,
      effectType: 'pressure',
      scope: 'local' as const,
      severity: 'medium' as const,
      notes: '',
      modifierEffectId: effects[0]?.id ?? null,
    },
  };
}

export function buildCampaignV2AuthoringPayload(
  source: CampaignV2AuthoringSource,
  requestedLocationId?: string | null,
  contentSubdir?: string | null,
): CampaignV2AuthoringPayload {
  const selectedLocation = findSelectedLocation(source, requestedLocationId);
  const readOnly = contentSubdir !== PRIMARY_CONTENT_SUBDIR;
  const sessionLocationTitleById = new Map(source.locations.map((location) => [location.id, location.title]));

  return {
    readOnly,
    readOnlyReason: readOnly
      ? 'Guided v2 authoring stays locked on shadow or experimental datasets. Switch to a primary campaign-v2 project to edit.'
      : null,
    selectedLocationId: selectedLocation?.id ?? null,
    selectedLocationTitle: selectedLocation?.title ?? null,
    locationOptions: source.locations.slice().sort(sortByTitle).map(summarizeLocation),
    parentLocationOptions: source.locations.slice().sort(sortByTitle).map(summarizeLocation),
    locationStateOptions: selectedLocation
      ? source.locationStates
          .filter((locationState) => locationState.locationId === selectedLocation.id)
          .slice()
          .sort(sortByTitle)
          .map(summarizeLocationState)
      : [],
    sessionOptions: selectedLocation
      ? getSessionsForLocation(selectedLocation, source).map((session) =>
          summarizeSession(session, sessionLocationTitleById.get(session.locationId) ?? null),
        )
      : [],
    followsSessionOptions: source.sessions
      .slice()
      .sort(sortByTitle)
      .map((session) => summarizeSession(session, sessionLocationTitleById.get(session.locationId) ?? null)),
    eventOptions: selectedLocation ? getEventsForLocation(selectedLocation, source).map(summarizeEvent) : [],
    effectOptions: selectedLocation ? getEffectsForLocation(selectedLocation, source).map(summarizeEffect) : [],
    modifierEffectOptions: source.effects.slice().sort(sortByTitle).map(summarizeEffect),
    locationDrafts: source.locations.slice().sort(sortByTitle).map((location) => ({
      id: location.id,
      title: location.title,
      summary: location.summary,
      tags: [...(location.tags ?? [])],
      parentLocationId: location.parentLocationId ?? null,
    })),
    locationStateDrafts: (selectedLocation
      ? source.locationStates.filter((locationState) => locationState.locationId === selectedLocation.id)
      : []
    )
      .slice()
      .sort(sortByTitle)
      .map((locationState) => ({
        id: locationState.id,
        locationId: locationState.locationId,
        title: locationState.title,
        summary: locationState.summary,
        status: locationState.status,
        notes: locationState.notes ?? '',
      })),
    sessionDrafts: (selectedLocation ? getSessionsForLocation(selectedLocation, source) : []).map((session) => ({
      id: session.id,
      locationId: session.locationId,
      title: session.title,
      summary: session.summary,
      notes: session.notes ?? '',
      startingLocationStateId: session.startingLocationStateId ?? null,
      resultingLocationStateId: session.resultingLocationStateId ?? null,
      followsSessionId: getFollowsSessionId(session),
    })),
    eventDrafts: (selectedLocation ? getEventsForLocation(selectedLocation, source) : []).map((event) => ({
      id: event.id,
      title: event.title,
      summary: event.summary,
      status: event.status,
      notes: event.notes ?? '',
      eventType: event.eventType ?? '',
      locationId: getManagedLocationId(event, source.locations),
      sessionId: getManagedSessionId(event, source.sessions),
      threadId: getManagedThreadId(event),
      createdEffectIds: [...(event.createdEffectIds ?? [])],
    })),
    effectDrafts: (selectedLocation ? getEffectsForLocation(selectedLocation, source) : []).map((effect) => ({
      id: effect.id,
      title: effect.title,
      summary: effect.summary,
      status: effect.status,
      notes: effect.notes ?? '',
      effectType: effect.effectType ?? '',
      scope: effect.scope ?? null,
      severity: effect.severity ?? null,
      locationId: getManagedEffectLocationId(effect, source.locations),
      modifierEffectId: getManagedModifierEffectId(effect, source.effects),
    })),
    defaults: createAuthoringDefaults(selectedLocation, source),
  };
}

function assertPrimaryContentSubdir(contentSubdir?: string) {
  if ((contentSubdir ?? PRIMARY_CONTENT_SUBDIR) !== PRIMARY_CONTENT_SUBDIR) {
    throw new Error('Campaign-v2 authoring only writes to the primary campaign-v2 dataset.');
  }
}

function assertNonEmpty(value: string, label: string) {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
}

function assertLocationExists(location: Location | null, locationId: string) {
  if (!location) {
    throw new Error(`Location ${locationId} does not exist.`);
  }

  return location;
}

function assertLocationStateExists(locationState: LocationState | null, locationStateId: string) {
  if (!locationState) {
    throw new Error(`Location state ${locationStateId} does not exist.`);
  }

  return locationState;
}

function assertSessionExists(session: Session | null, sessionId: string) {
  if (!session) {
    throw new Error(`Session ${sessionId} does not exist.`);
  }

  return session;
}

function assertEffectExists(effect: Effect | null, effectId: string) {
  if (!effect) {
    throw new Error(`Effect ${effectId} does not exist.`);
  }

  return effect;
}

function assertNoLocationCycle(locations: readonly Location[], locationId: string, parentLocationId: string | null) {
  if (!parentLocationId) {
    return;
  }

  if (parentLocationId === locationId) {
    throw new Error('A location cannot be its own parent.');
  }

  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const seen = new Set<string>([locationId]);
  let currentId: string | null = parentLocationId;

  while (currentId) {
    if (seen.has(currentId)) {
      throw new Error('That parent location would create a cycle.');
    }

    seen.add(currentId);
    currentId = locationsById.get(currentId)?.parentLocationId ?? null;
  }
}

function replaceManagedRelations(
  existingRelations: readonly Relation[] | null | undefined,
  shouldReplace: (relation: Relation) => boolean,
  appendedRelations: readonly Relation[],
) {
  return normalizeCampaignV2Relations([
    ...(existingRelations ?? []).filter((relation) => !shouldReplace(relation)),
    ...appendedRelations,
  ]);
}

function collectLocationIds(locations: readonly Location[]) {
  return new Set(locations.map((location) => location.id));
}

function collectSessionIds(sessions: readonly Session[]) {
  return new Set(sessions.map((session) => session.id));
}

function collectEffectIds(effects: readonly Effect[]) {
  return new Set(effects.map((effect) => effect.id));
}

function buildManagedEventRelations(
  event: Event,
  locations: readonly Location[],
  sessions: readonly Session[],
  {
    locationId,
    sessionId,
    threadId,
  }: {
    locationId: string | null;
    sessionId: string | null;
    threadId: string | null;
  },
) {
  const locationIds = collectLocationIds(locations);
  const sessionIds = collectSessionIds(sessions);
  const baseRelations = replaceManagedRelations(
    event.relations,
    (relation) =>
      ((relation.type === 'occursAt' || relation.type === 'involves') && locationIds.has(relation.targetId)) ||
      (relation.type === 'relatedTo' && (sessionIds.has(relation.targetId) || relation.targetId.startsWith('thread-'))),
    [],
  );

  let nextEvent: Event = {
    ...event,
    relations: baseRelations,
  };

  if (locationId) {
    nextEvent = attachEventToLocation(nextEvent, locationId);
  }

  if (sessionId) {
    nextEvent = attachEventToSession(nextEvent, sessionId);
  }

  if (threadId) {
    nextEvent = attachEventToThread(nextEvent, threadId);
  }

  return nextEvent;
}

function buildManagedEffectRelations(
  effect: Effect,
  locations: readonly Location[],
  effects: readonly Effect[],
  {
    locationId,
    modifierEffectId,
  }: {
    locationId: string | null;
    modifierEffectId: string | null;
  },
) {
  const locationIds = collectLocationIds(locations);
  const effectIds = collectEffectIds(effects);
  const baseRelations = replaceManagedRelations(
    effect.relations,
    (relation) =>
      ((relation.type === 'appliesTo' || relation.type === 'occursAt') && locationIds.has(relation.targetId)) ||
      (relation.type === 'modifies' && effectIds.has(relation.targetId)),
    [],
  );

  let nextEffect: Effect = {
    ...effect,
    relations: baseRelations,
  };

  if (locationId) {
    nextEffect = attachEffectToLocation(nextEffect, locationId);
  }

  if (modifierEffectId) {
    nextEffect = attachEffectModifier(nextEffect, modifierEffectId);
  }

  return nextEffect;
}

function assertStateBelongsToLocation(
  locationStateId: string | null | undefined,
  locationId: string,
  locationStates: readonly LocationState[],
) {
  if (!locationStateId) {
    return null;
  }

  const locationState = assertLocationStateExists(
    locationStates.find((entry) => entry.id === locationStateId) ?? null,
    locationStateId,
  );

  if (locationState.locationId !== locationId) {
    throw new Error(`Location state ${locationStateId} does not belong to location ${locationId}.`);
  }

  return locationState;
}

export async function applyCampaignV2AuthoringAction(
  options: CampaignV2StorageOptions & { input: CampaignV2AuthoringAction },
): Promise<CampaignV2AuthoringMutation> {
  assertPrimaryContentSubdir(options.contentSubdir);

  const store = await createCampaignV2Store({
    ...options,
    contentSubdir: PRIMARY_CONTENT_SUBDIR,
  });
  const snapshot = store.getSnapshot();

  switch (options.input.action) {
    case 'upsertLocation': {
      const title = normalizeText(options.input.title);
      const summary = normalizeText(options.input.summary);
      assertNonEmpty(title, 'Location title');
      assertNonEmpty(summary, 'Location summary');
      const tags = normalizeTags(options.input.tags);
      const parentLocationId = options.input.parentLocationId ?? null;
      if (parentLocationId) {
        assertLocationExists(store.getLocation(parentLocationId), parentLocationId);
      }

      const existingLocation = options.input.locationId ? store.getLocation(options.input.locationId) : null;
      const existingIds = new Set(snapshot.locations.map((location) => location.id));
      const nextLocationId =
        existingLocation?.id ?? createUniqueId('location-', title, existingIds);
      assertNoLocationCycle(snapshot.locations, nextLocationId, parentLocationId);

      const location: Location = {
        id: nextLocationId,
        type: 'location',
        campaignId: options.projectId,
        title,
        summary,
        tags,
        parentLocationId,
        relations: existingLocation?.relations ?? [],
      };

      await store.saveLocation(location);

      return {
        action: existingLocation ? 'updated' : 'created',
        entityKind: 'location',
        entityId: location.id,
        entityTitle: location.title,
        message: existingLocation
          ? `Updated location ${location.title}.`
          : `Created location ${location.title}.`,
        selectedLocationId: location.id,
      };
    }

    case 'upsertLocationState': {
      const location = assertLocationExists(store.getLocation(options.input.locationId), options.input.locationId);
      const title = normalizeText(options.input.title);
      const summary = normalizeText(options.input.summary);
      assertNonEmpty(title, 'Location state title');
      assertNonEmpty(summary, 'Location state summary');
      const notes = normalizeOptionalText(options.input.notes);
      const existingLocationState = options.input.locationStateId ? store.getLocationState(options.input.locationStateId) : null;

      let locationState: LocationState;
      if (existingLocationState) {
        if (existingLocationState.locationId !== location.id) {
          throw new Error(`Location state ${existingLocationState.id} does not belong to location ${location.id}.`);
        }

        locationState = {
          ...existingLocationState,
          title,
          summary,
          status: options.input.status,
          notes,
        };
      } else {
        const stage = options.input.stage ?? 'initial';
        const expectedId = createLocationStateId(location.id, stage);
        if (store.getLocationState(expectedId)) {
          throw new Error(`A ${stage} location state already exists for ${location.title}. Edit it instead of creating another one.`);
        }

        locationState =
          stage === 'post-major-visit'
            ? createPostMajorVisitLocationState(location, {
                title,
                summary,
                status: options.input.status,
                notes,
              })
            : createInitialLocationState(location, {
                title,
                summary,
                status: options.input.status,
                notes,
              });
      }

      await store.saveLocationState(locationState);

      return {
        action: existingLocationState ? 'updated' : 'created',
        entityKind: 'locationState',
        entityId: locationState.id,
        entityTitle: locationState.title,
        message: existingLocationState
          ? `Updated location state ${locationState.title}.`
          : `Created location state ${locationState.title}.`,
        selectedLocationId: location.id,
      };
    }

    case 'upsertSession': {
      const location = assertLocationExists(store.getLocation(options.input.locationId), options.input.locationId);
      const title = normalizeText(options.input.title);
      const summary = normalizeText(options.input.summary);
      assertNonEmpty(title, 'Session title');
      assertNonEmpty(summary, 'Session summary');
      const notes = normalizeOptionalText(options.input.notes);
      const startingState = assertStateBelongsToLocation(
        options.input.startingLocationStateId,
        location.id,
        snapshot.locationStates,
      );
      const resultingState = assertStateBelongsToLocation(
        options.input.resultingLocationStateId,
        location.id,
        snapshot.locationStates,
      );
      const followsSessionId = options.input.followsSessionId ?? null;
      if (followsSessionId) {
        const followedSession = assertSessionExists(store.getSession(followsSessionId), followsSessionId);
        if (options.input.sessionId && followedSession.id === options.input.sessionId) {
          throw new Error('A session cannot follow itself.');
        }
      }

      const existingSession = options.input.sessionId ? store.getSession(options.input.sessionId) : null;
      const existingIds = new Set(snapshot.sessions.map((session) => session.id));
      const nextSessionId = existingSession?.id ?? createUniqueId('session-', title, existingIds);
      const baseRelations = replaceManagedRelations(
        existingSession?.relations ?? [],
        (relation) => relation.type === 'follows',
        followsSessionId
          ? [
              {
                type: 'follows',
                targetId: followsSessionId,
              },
            ]
          : [],
      );

      const session = createCampaignV2Session({
        id: nextSessionId,
        title,
        locationId: location.id,
        summary,
        notes,
        startingLocationStateId: startingState?.id ?? null,
        resultingLocationStateId: resultingState?.id ?? null,
        relations: baseRelations,
      });

      await store.saveSession(session);

      return {
        action: existingSession ? 'updated' : 'created',
        entityKind: 'session',
        entityId: session.id,
        entityTitle: session.title,
        message: existingSession ? `Updated session ${session.title}.` : `Created session ${session.title}.`,
        selectedLocationId: location.id,
      };
    }

    case 'upsertEvent': {
      const title = normalizeText(options.input.title);
      const summary = normalizeText(options.input.summary);
      assertNonEmpty(title, 'Event title');
      assertNonEmpty(summary, 'Event summary');
      const notes = normalizeOptionalText(options.input.notes);
      const locationId = options.input.locationId ?? null;
      const sessionId = options.input.sessionId ?? null;
      const threadId = normalizeOptionalText(options.input.threadId);
      const createdEffectIds = [...new Set((options.input.createdEffectIds ?? []).filter((effectId) => effectId.trim().length > 0))];

      if (!locationId && !sessionId && !threadId) {
        throw new Error('Events need at least one context link: location, session, or thread.');
      }

      const location = locationId ? assertLocationExists(store.getLocation(locationId), locationId) : null;
      const session = sessionId ? assertSessionExists(store.getSession(sessionId), sessionId) : null;
      for (const effectId of createdEffectIds) {
        assertEffectExists(store.getEffect(effectId), effectId);
      }

      const existingEvent = options.input.eventId ? store.getEvent(options.input.eventId) : null;
      const existingIds = new Set(snapshot.events.map((event) => event.id));
      const nextEventId = existingEvent?.id ?? createUniqueId('event-', title, existingIds);
      const baseEvent = createCampaignV2Event({
        id: nextEventId,
        title,
        summary,
        status: options.input.status,
        notes,
        eventType: normalizeOptionalText(options.input.eventType),
        createdEffectIds,
        relations: existingEvent?.relations ?? [],
      });
      const event = buildManagedEventRelations(baseEvent, snapshot.locations, snapshot.sessions, {
        locationId: location?.id ?? session?.locationId ?? null,
        sessionId: session?.id ?? null,
        threadId,
      });

      await store.saveEvent(event);

      return {
        action: existingEvent ? 'updated' : 'created',
        entityKind: 'event',
        entityId: event.id,
        entityTitle: event.title,
        message: existingEvent ? `Updated event ${event.title}.` : `Created event ${event.title}.`,
        selectedLocationId: location?.id ?? session?.locationId ?? null,
      };
    }

    case 'upsertEffect': {
      const title = normalizeText(options.input.title);
      const summary = normalizeText(options.input.summary);
      assertNonEmpty(title, 'Effect title');
      assertNonEmpty(summary, 'Effect summary');
      const notes = normalizeOptionalText(options.input.notes);
      const scope = options.input.scope ?? null;
      const locationId = options.input.locationId ?? null;
      const modifierEffectId = options.input.modifierEffectId ?? null;

      const location = locationId ? assertLocationExists(store.getLocation(locationId), locationId) : null;
      if ((scope === 'local' || scope === 'subtree') && !location) {
        throw new Error(`Effects with ${scope} scope need a location context.`);
      }

      if (modifierEffectId) {
        assertEffectExists(store.getEffect(modifierEffectId), modifierEffectId);
      }

      const existingEffect = options.input.effectId ? store.getEffect(options.input.effectId) : null;
      const existingIds = new Set(snapshot.effects.map((effect) => effect.id));
      const nextEffectId = existingEffect?.id ?? createUniqueId('effect-', title, existingIds);
      if (modifierEffectId && modifierEffectId === nextEffectId) {
        throw new Error('An effect cannot modify itself.');
      }

      const baseEffect = createCampaignV2Effect({
        id: nextEffectId,
        title,
        summary,
        status: options.input.status,
        notes,
        effectType: normalizeOptionalText(options.input.effectType),
        scope,
        severity: options.input.severity ?? null,
        relations: existingEffect?.relations ?? [],
      });
      const effect = buildManagedEffectRelations(baseEffect, snapshot.locations, snapshot.effects, {
        locationId: location?.id ?? null,
        modifierEffectId,
      });

      await store.saveEffect(effect);

      return {
        action: existingEffect ? 'updated' : 'created',
        entityKind: 'effect',
        entityId: effect.id,
        entityTitle: effect.title,
        message: existingEffect ? `Updated effect ${effect.title}.` : `Created effect ${effect.title}.`,
        selectedLocationId: location?.id ?? null,
      };
    }
  }
}

export function getCampaignV2StatusLabel(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return STATUS_LABELS.get(value) ?? value;
}
