import type {
  CampaignV2EffectViewModel,
  CampaignV2EventViewModel,
  CampaignV2GmOverviewPayload,
  CampaignV2LocationTimelinePayload,
  CampaignV2OverviewLocationViewModel,
  CampaignV2ResolverSource,
} from './resolvers';
import { buildCampaignV2GmOverview, buildCampaignV2LocationTimeline } from './resolvers';

export type CampaignV2PrepAnswerKey =
  | 'whatChangedHereLastTime'
  | 'whatIsActiveNow'
  | 'whatBroaderEffectsAreInScope'
  | 'whatShouldIPrepNext';

export type CampaignV2PrepReferenceKind = 'location' | 'locationState' | 'session' | 'event' | 'effect';

export type CampaignV2PrepReference = {
  kind: CampaignV2PrepReferenceKind;
  id: string;
  title: string;
};

export type CampaignV2PrepAnswer = {
  key: CampaignV2PrepAnswerKey;
  question: string;
  summary: string;
  bullets: string[];
  references: CampaignV2PrepReference[];
};

export type CampaignV2PrepPayload = {
  projectId: string;
  loadedAt: string | null;
  selectedLocationId: string | null;
  selectedLocationTitle: string | null;
  answers: Record<CampaignV2PrepAnswerKey, CampaignV2PrepAnswer>;
};

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function uniqueReferences(values: readonly CampaignV2PrepReference[]) {
  return [...new Map(values.map((value) => [`${value.kind}:${value.id}`, value])).values()];
}

function createReference(kind: CampaignV2PrepReferenceKind, id: string | null | undefined, title: string | null | undefined) {
  if (!id || !title) {
    return null;
  }

  return {
    kind,
    id,
    title,
  } satisfies CampaignV2PrepReference;
}

function createAnswer(
  key: CampaignV2PrepAnswerKey,
  question: string,
  summary: string,
  bullets: readonly string[],
  references: readonly (CampaignV2PrepReference | null)[],
): CampaignV2PrepAnswer {
  return {
    key,
    question,
    summary,
    bullets: uniqueStrings([...bullets]),
    references: uniqueReferences(references.filter((value): value is CampaignV2PrepReference => Boolean(value))),
  };
}

function isActiveLikeEvent(event: CampaignV2EventViewModel) {
  return event.status === 'active' || event.status === 'available';
}

function isActiveLikeEffect(effect: CampaignV2EffectViewModel) {
  return effect.status === 'active';
}

function findLastHistoricalSession(
  overview: CampaignV2GmOverviewPayload,
  locationTimeline: CampaignV2LocationTimelinePayload | null,
) {
  const currentSessionId =
    overview.currentSession && overview.currentSession.locationId === locationTimeline?.location.id
      ? overview.currentSession.id
      : null;

  return (
    locationTimeline?.entries
      .filter((entry) => entry.kind === 'session' && entry.id !== currentSessionId)
      .slice()
      .reverse()[0] ?? null
  );
}

function answerWhatChangedHereLastTime(
  overview: CampaignV2GmOverviewPayload,
  locationTimeline: CampaignV2LocationTimelinePayload | null,
): CampaignV2PrepAnswer {
  if (!locationTimeline) {
    return createAnswer(
      'whatChangedHereLastTime',
      'What changed here last time?',
      'No v2 location timeline is available yet for this prep view.',
      ['Pick a location with v2 timeline data to get a last-visit summary.'],
      [],
    );
  }

  const lastSession = findLastHistoricalSession(overview, locationTimeline);
  if (!lastSession || lastSession.kind !== 'session') {
    return createAnswer(
      'whatChangedHereLastTime',
      'What changed here last time?',
      `No earlier session history is linked to ${locationTimeline.location.title} yet.`,
      [
        'The location can still be prepped from its current state, but there is not a recorded prior visit to summarize.',
      ],
      [createReference('location', locationTimeline.location.id, locationTimeline.location.title)],
    );
  }

  const relatedEvents = locationTimeline.relatedEvents.filter((event) => lastSession.relatedEventIds.includes(event.id));
  const relatedEffects = locationTimeline.relatedEffects.filter((effect) => lastSession.relatedEffectIds.includes(effect.id));

  return createAnswer(
    'whatChangedHereLastTime',
    'What changed here last time?',
    `${locationTimeline.location.title} last shifted during ${lastSession.title}.`,
    [
      `Session: ${lastSession.summary}`,
      lastSession.startingLocationStateTitle ? `Before: ${lastSession.startingLocationStateTitle}` : '',
      lastSession.resultingLocationStateTitle ? `After: ${lastSession.resultingLocationStateTitle}` : '',
      relatedEvents.length > 0 ? `Key events: ${relatedEvents.slice(0, 3).map((event) => event.title).join(', ')}` : '',
      relatedEffects.length > 0 ? `Ongoing pressure left behind: ${relatedEffects.slice(0, 3).map((effect) => effect.title).join(', ')}` : '',
    ],
    [
      createReference('location', locationTimeline.location.id, locationTimeline.location.title),
      createReference('session', lastSession.id, lastSession.title),
      createReference('locationState', lastSession.startingLocationStateId, lastSession.startingLocationStateTitle),
      createReference('locationState', lastSession.resultingLocationStateId, lastSession.resultingLocationStateTitle),
      ...relatedEvents.map((event) => createReference('event', event.id, event.title)),
      ...relatedEffects.map((effect) => createReference('effect', effect.id, effect.title)),
    ],
  );
}

function answerWhatIsActiveNow(overview: CampaignV2GmOverviewPayload): CampaignV2PrepAnswer {
  const activeEvents = overview.relatedEvents.filter(isActiveLikeEvent);
  const activeEffects = overview.relatedEffects.filter(isActiveLikeEffect);

  return createAnswer(
    'whatIsActiveNow',
    'What is active now?',
    overview.currentSession
      ? `The active v2 anchor is ${overview.currentSession.title}${overview.currentSession.locationTitle ? ` at ${overview.currentSession.locationTitle}` : ''}.`
      : 'There is no active v2 session anchor yet, so active pressure comes from events and effects only.',
    [
      overview.currentSession ? `Current session: ${overview.currentSession.summary}` : 'No current session is marked active.',
      activeEvents.length > 0 ? `Active events: ${activeEvents.slice(0, 4).map((event) => event.title).join(', ')}` : 'No active or available v2 events are linked to the current overview.',
      activeEffects.length > 0 ? `Active effects: ${activeEffects.slice(0, 4).map((effect) => effect.title).join(', ')}` : 'No active v2 effects are in scope right now.',
    ],
    [
      createReference('session', overview.currentSession?.id ?? null, overview.currentSession?.title ?? null),
      createReference('location', overview.currentSession?.locationId ?? null, overview.currentSession?.locationTitle ?? null),
      ...activeEvents.map((event) => createReference('event', event.id, event.title)),
      ...activeEffects.map((effect) => createReference('effect', effect.id, effect.title)),
    ],
  );
}

function answerWhatBroaderEffectsAreInScope(locationTimeline: CampaignV2LocationTimelinePayload | null): CampaignV2PrepAnswer {
  if (!locationTimeline) {
    return createAnswer(
      'whatBroaderEffectsAreInScope',
      'What broader effects are in scope?',
      'No v2 location is selected, so broader inherited pressure cannot be resolved yet.',
      ['Choose a location with v2 data to inspect inherited effects and local modifiers.'],
      [],
    );
  }

  const relevance = locationTimeline.relatedEffects
    .map((effect) => ({
      effect,
      entry: effect.relevanceByLocation.find((item) => item.locationId === locationTimeline.location.id) ?? null,
    }))
    .filter((item) => item.entry && item.entry.kinds.some((kind) => kind === 'inherited' || kind === 'modifier'));
  const inherited = relevance.filter((item) => item.entry?.kinds.includes('inherited'));
  const modifiers = relevance.filter((item) => item.entry?.kinds.includes('modifier'));

  if (relevance.length === 0) {
    return createAnswer(
      'whatBroaderEffectsAreInScope',
      'What broader effects are in scope?',
      `${locationTimeline.location.title} does not currently inherit any broader v2 effects.`,
      ['Prep can focus on the local state and directly attached events without city-wide or subtree pressure leaking in.'],
      [createReference('location', locationTimeline.location.id, locationTimeline.location.title)],
    );
  }

  return createAnswer(
    'whatBroaderEffectsAreInScope',
    'What broader effects are in scope?',
    `${locationTimeline.location.title} inherits broader pressure and may also have local modifiers that change how it plays.`,
    [
      inherited.length > 0 ? `Inherited effects: ${inherited.map((item) => item.effect.title).join(', ')}` : '',
      modifiers.length > 0 ? `Local modifiers of broader pressure: ${modifiers.map((item) => item.effect.title).join(', ')}` : 'No local modifiers are currently overriding those broader effects.',
    ],
    [
      createReference('location', locationTimeline.location.id, locationTimeline.location.title),
      ...relevance.map((item) => createReference('effect', item.effect.id, item.effect.title)),
    ],
  );
}

function describeNextLocation(location: CampaignV2OverviewLocationViewModel) {
  const reasonText =
    location.reasons.length > 0
      ? ` (${location.reasons.join(', ')})`
      : '';
  return `${location.title}${reasonText}`;
}

function answerWhatShouldIPrepNext(
  overview: CampaignV2GmOverviewPayload,
  locationTimeline: CampaignV2LocationTimelinePayload | null,
): CampaignV2PrepAnswer {
  const prepLocations = overview.likelyNextLocations.slice(0, 3);
  const prepEvents = overview.relatedEvents.filter((event) => event.status === 'available' || event.status === 'active').slice(0, 3);
  const prepEffects = overview.relatedEffects.filter(isActiveLikeEffect).slice(0, 3);

  return createAnswer(
    'whatShouldIPrepNext',
    'What should I prep next?',
    prepLocations.length > 0
      ? `Prep should stay centered on ${prepLocations.map((location) => location.title).join(', ')} after the current scene.`
      : overview.currentSession
        ? `Prep should deepen the immediate fallout around ${overview.currentSession.title}.`
        : 'Prep should start with the most connected v2 location and its active pressure.',
    [
      overview.currentSession ? `Anchor scene: ${overview.currentSession.title}` : '',
      prepLocations.length > 0 ? `Likely next locations: ${prepLocations.map(describeNextLocation).join('; ')}` : 'No next-location hints are linked yet.',
      prepEvents.length > 0 ? `Prep these events: ${prepEvents.map((event) => event.title).join(', ')}` : 'No active or available follow-up events are linked yet.',
      prepEffects.length > 0 ? `Watch these ongoing effects: ${prepEffects.map((effect) => effect.title).join(', ')}` : '',
      locationTimeline ? `Selected location timeline entries: ${locationTimeline.entries.length}` : '',
    ],
    [
      createReference('session', overview.currentSession?.id ?? null, overview.currentSession?.title ?? null),
      ...prepLocations.map((location) => createReference('location', location.id, location.title)),
      ...prepEvents.map((event) => createReference('event', event.id, event.title)),
      ...prepEffects.map((effect) => createReference('effect', effect.id, effect.title)),
    ],
  );
}

export function buildCampaignV2PrepPayload(
  source: CampaignV2ResolverSource,
  requestedLocationId?: string | null,
): CampaignV2PrepPayload {
  const overview = buildCampaignV2GmOverview(source);
  const selectedLocationId = requestedLocationId ?? overview.currentSession?.locationId ?? source.locations[0]?.id ?? null;
  const locationTimeline = selectedLocationId ? buildCampaignV2LocationTimeline(source, selectedLocationId) : null;

  return {
    projectId: source.projectId,
    loadedAt: overview.loadedAt,
    selectedLocationId,
    selectedLocationTitle: locationTimeline?.location.title ?? null,
    answers: {
      whatChangedHereLastTime: answerWhatChangedHereLastTime(overview, locationTimeline),
      whatIsActiveNow: answerWhatIsActiveNow(overview),
      whatBroaderEffectsAreInScope: answerWhatBroaderEffectsAreInScope(locationTimeline),
      whatShouldIPrepNext: answerWhatShouldIPrepNext(overview, locationTimeline),
    },
  };
}

export function answerCampaignV2PrepQuestion(
  source: CampaignV2ResolverSource,
  key: CampaignV2PrepAnswerKey,
  requestedLocationId?: string | null,
) {
  return buildCampaignV2PrepPayload(source, requestedLocationId).answers[key];
}
