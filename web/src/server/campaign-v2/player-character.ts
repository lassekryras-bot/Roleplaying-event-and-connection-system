import type {
  Effect,
  Event,
  Location,
  LocationState,
  Npc,
  PlayerCharacterRelation,
  PlayerCharacter,
  Session,
} from '@/generated/campaign-v2';

import type { CampaignV2Diagnostic } from './errors';
import { formatCampaignV2Diagnostic } from './errors';
import { type CampaignLegacyThreadSummary } from './legacy-threads';
import {
  createCampaignV2RelationGraph,
  normalizeCampaignV2Document,
  type CampaignV2DocumentRecordMap,
  type CampaignV2ObjectKind,
} from './relations';

type CampaignV2CharacterResolverSource = {
  projectId: string;
  loadedAt?: Date | string | null;
  locations?: readonly Location[];
  locationStates?: readonly LocationState[];
  sessions?: readonly Session[];
  events?: readonly Event[];
  effects?: readonly Effect[];
  playerCharacters?: readonly PlayerCharacter[];
  npcs?: readonly Npc[];
  legacyThreads?: readonly CampaignLegacyThreadSummary[];
  diagnostics?: readonly CampaignV2Diagnostic[];
};

export type CampaignV2PlayerCharacterSummaryViewModel = {
  id: string;
  title: string;
  summary: string;
  status: PlayerCharacter['status'];
  concept: string;
  partyRole: string | null;
};

export type CampaignV2PlayerCharacterThreadViewModel = {
  id: string;
  title: string;
  state: string | null;
  playerSummary: string | null;
  gmTruth: string | null;
  href: string;
  missing: boolean;
};

export type CampaignV2PlayerCharacterEntityLinkViewModel = {
  id: string;
  title: string;
  type: CampaignV2ObjectKind | 'thread' | 'hook';
  summary: string | null;
  status: string | null;
  href: string | null;
  missing: boolean;
};

export type CampaignV2PlayerCharacterRelationViewModel = {
  type: PlayerCharacterRelation['type'];
  targetId: string;
  targetTitle: string;
  targetType: CampaignV2ObjectKind | 'thread' | 'unknown';
  note: string | null;
  status: string | null;
  strength: string | null;
  origin: string | null;
  active: boolean | null;
  href: string | null;
  missing: boolean;
};

export type CampaignV2PlayerCharacterDetailViewModel = {
  id: string;
  title: string;
  summary: string;
  status: PlayerCharacter['status'];
  concept: string;
  partyRole: string | null;
  ancestry: string | null;
  characterClass: string | null;
  age: number | null;
  background: {
    origin: string | null;
    history: string | null;
    incitingIncident: string | null;
    reasonInCity: string | null;
  };
  currentSituation: {
    overview: string | null;
    legalStatus: string | null;
    socialStatus: string | null;
    currentProblem: string | null;
    currentLocationId: string | null;
    currentLocationTitle: string | null;
    currentLocationHref: string | null;
  };
  goals: {
    shortTerm: string | null;
    midTerm: string | null;
    longTerm: string | null;
  };
  traits: {
    strengths: string[];
    flaws: string[];
    personality: string[];
  };
  spotlight: {
    themes: string[];
    gmNotes: string | null;
  };
  campaignFitSummary: string;
  startingThreads: CampaignV2PlayerCharacterThreadViewModel[];
  coreThreads: CampaignV2PlayerCharacterThreadViewModel[];
  relations: CampaignV2PlayerCharacterRelationViewModel[];
  linkedEntities: CampaignV2PlayerCharacterEntityLinkViewModel[];
  relationshipNotes: Array<{
    label: string;
    role: string;
    note: string | null;
  }>;
  assets: {
    signatureItems: string[];
    specialCapabilities: string[];
  };
  connections: {
    importantNpcs: CampaignV2PlayerCharacterEntityLinkViewModel[];
    importantLocations: CampaignV2PlayerCharacterEntityLinkViewModel[];
    importantThreads: CampaignV2PlayerCharacterThreadViewModel[];
    importantHooks: CampaignV2PlayerCharacterEntityLinkViewModel[];
  };
  notes: string | null;
};

export type CampaignV2PlayerCharacterDetailPayload = {
  projectId: string;
  loadedAt: string | null;
  playerCharacter: CampaignV2PlayerCharacterDetailViewModel;
  diagnosticMessages: string[];
};

type CharacterResolverContext = {
  projectId: string;
  loadedAt: string | null;
  locationsById: Map<string, Location>;
  relationGraph: ReturnType<typeof createCampaignV2RelationGraph>;
  playerCharactersById: Map<string, PlayerCharacter>;
  legacyThreadsById: Map<string, CampaignLegacyThreadSummary>;
  diagnostics: string[];
};

function normalizeLoadedAt(value: CampaignV2CharacterResolverSource['loadedAt']) {
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

function uniqueByKey<T>(values: readonly T[], getKey: (value: T) => string) {
  return [...new Map(values.map((value) => [getKey(value), value])).values()];
}

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sanitizeStringArray(values: readonly string[] | null | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

function buildLocationHref(projectId: string, locationId: string) {
  const params = new URLSearchParams({
    project: projectId,
    location: locationId,
  });

  return `/timeline?${params.toString()}`;
}

function buildPlayerCharacterHref(projectId: string, playerCharacterId: string) {
  const params = new URLSearchParams({
    project: projectId,
  });

  return `/player-characters/${encodeURIComponent(playerCharacterId)}?${params.toString()}`;
}

function buildEntityHref(projectId: string, kind: CampaignV2ObjectKind | 'thread', id: string) {
  switch (kind) {
    case 'location':
      return buildLocationHref(projectId, id);
    case 'playerCharacter':
      return buildPlayerCharacterHref(projectId, id);
    case 'thread':
      return `/threads/${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

function compareEntityLinks(
  left: CampaignV2PlayerCharacterEntityLinkViewModel,
  right: CampaignV2PlayerCharacterEntityLinkViewModel,
) {
  return left.type.localeCompare(right.type) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function createContext(source: CampaignV2CharacterResolverSource): CharacterResolverContext {
  const locations = source.locations ?? [];
  const locationStates = source.locationStates ?? [];
  const sessions = source.sessions ?? [];
  const events = source.events ?? [];
  const effects = source.effects ?? [];
  const playerCharacters = source.playerCharacters ?? [];
  const npcs = source.npcs ?? [];
  const relationGraph = createCampaignV2RelationGraph({
    locations,
    locationStates,
    sessions,
    events,
    effects,
    playerCharacters,
    npcs,
  });

  return {
    projectId: source.projectId,
    loadedAt: normalizeLoadedAt(source.loadedAt),
    locationsById: toMap(locations),
    relationGraph,
    playerCharactersById: new Map<string, PlayerCharacter>(
      playerCharacters.map((playerCharacter) => [playerCharacter.id, normalizeRawPlayerCharacter(playerCharacter)]),
    ),
    legacyThreadsById: toMap(source.legacyThreads ?? []),
    diagnostics: (source.diagnostics ?? []).map((diagnostic) => formatCampaignV2Diagnostic(diagnostic)),
  };
}

function normalizeRawPlayerCharacter(playerCharacter: PlayerCharacter): PlayerCharacter {
  return {
    ...playerCharacter,
    relations: Array.isArray(playerCharacter.relations) ? [...playerCharacter.relations] : [],
  };
}

function toThreadViewModel(
  projectId: string,
  threadId: string,
  thread: CampaignLegacyThreadSummary | null,
): CampaignV2PlayerCharacterThreadViewModel {
  return {
    id: threadId,
    title: thread?.title ?? threadId,
    state: thread?.state ?? null,
    playerSummary: thread?.playerSummary ?? null,
    gmTruth: thread?.gmTruth ?? null,
    href: buildEntityHref(projectId, 'thread', threadId) ?? `/threads/${encodeURIComponent(threadId)}`,
    missing: thread === null,
  };
}

function toEntityLinkFromObject(
  projectId: string,
  object: CampaignV2DocumentRecordMap[CampaignV2ObjectKind],
): CampaignV2PlayerCharacterEntityLinkViewModel {
  return {
    id: object.id,
    title: object.title,
    type: object.type,
    summary: normalizeText('summary' in object ? object.summary : null),
    status: normalizeText('status' in object ? object.status : null),
    href: buildEntityHref(projectId, object.type, object.id),
    missing: false,
  };
}

function toHookLink(hookId: string): CampaignV2PlayerCharacterEntityLinkViewModel {
  return {
    id: hookId,
    title: hookId,
    type: 'hook',
    summary: null,
    status: null,
    href: null,
    missing: false,
  };
}

function buildRelationViewModels(
  context: CharacterResolverContext,
  playerCharacter: PlayerCharacter,
) {
  return playerCharacter.relations.map((relation) => {
    const target = context.relationGraph.getObject(relation.targetId);
    const legacyThread = target ? null : context.legacyThreadsById.get(relation.targetId) ?? null;

    return {
      type: relation.type,
      targetId: relation.targetId,
      targetTitle: target?.title ?? legacyThread?.title ?? relation.targetId,
      targetType: target?.type ?? (legacyThread ? 'thread' : 'unknown'),
      note: relation.note ?? null,
      status: normalizeText(relation.status),
      strength: normalizeText(relation.strength),
      origin: normalizeText(relation.origin),
      active: typeof relation.active === 'boolean' ? relation.active : null,
      href: target
        ? buildEntityHref(context.projectId, target.type, target.id)
        : legacyThread
          ? buildEntityHref(context.projectId, 'thread', legacyThread.id)
          : null,
      missing: !target && !legacyThread,
    } satisfies CampaignV2PlayerCharacterRelationViewModel;
  });
}

function buildLinkedEntities(
  context: CharacterResolverContext,
  playerCharacter: PlayerCharacter,
) {
  const linkedEntities = [
    ...(playerCharacter.connections?.importantNpcIds ?? [])
      .map((npcId) => context.relationGraph.getObject(npcId))
      .filter((candidate): candidate is CampaignV2DocumentRecordMap[CampaignV2ObjectKind] => Boolean(candidate))
      .map((object) => toEntityLinkFromObject(context.projectId, object)),
    ...(playerCharacter.connections?.importantLocationIds ?? [])
      .map((locationId) => context.locationsById.get(locationId) ?? null)
      .filter((candidate): candidate is Location => Boolean(candidate))
      .map((location) =>
        toEntityLinkFromObject(context.projectId, normalizeCampaignV2Document(location) as CampaignV2DocumentRecordMap['location']),
      ),
    ...(playerCharacter.connections?.importantThreadIds ?? [])
      .map((threadId) => toThreadViewModel(context.projectId, threadId, context.legacyThreadsById.get(threadId) ?? null))
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        type: 'thread' as const,
        summary: thread.playerSummary,
        status: thread.state,
        href: thread.href,
        missing: thread.missing,
      })),
    ...(playerCharacter.connections?.importantHookIds ?? []).map(toHookLink),
  ];

  return uniqueByKey(linkedEntities, (entry) => `${entry.type}:${entry.id}`).sort(compareEntityLinks);
}

function buildConnectionLinks(
  context: CharacterResolverContext,
  playerCharacter: PlayerCharacter,
) {
  const importantNpcs = (playerCharacter.connections?.importantNpcIds ?? []).map((npcId) => {
    const object = context.relationGraph.getObject(npcId);
    if (!object || object.type !== 'npc') {
      return {
        id: npcId,
        title: npcId,
        type: 'npc',
        summary: null,
        status: null,
        href: null,
        missing: true,
      } satisfies CampaignV2PlayerCharacterEntityLinkViewModel;
    }

    return toEntityLinkFromObject(context.projectId, object);
  });

  const importantLocations = (playerCharacter.connections?.importantLocationIds ?? []).map((locationId) => {
    const location = context.locationsById.get(locationId);
    if (!location) {
      return {
        id: locationId,
        title: locationId,
        type: 'location',
        summary: null,
        status: null,
        href: buildLocationHref(context.projectId, locationId),
        missing: true,
      } satisfies CampaignV2PlayerCharacterEntityLinkViewModel;
    }

    return toEntityLinkFromObject(
      context.projectId,
      normalizeCampaignV2Document(location) as CampaignV2DocumentRecordMap['location'],
    );
  });

  const importantThreads = (playerCharacter.connections?.importantThreadIds ?? []).map((threadId) =>
    toThreadViewModel(context.projectId, threadId, context.legacyThreadsById.get(threadId) ?? null),
  );

  return {
    importantNpcs,
    importantLocations,
    importantThreads,
    importantHooks: (playerCharacter.connections?.importantHookIds ?? []).map(toHookLink),
  };
}

function toSummaryViewModel(playerCharacter: PlayerCharacter): CampaignV2PlayerCharacterSummaryViewModel {
  return {
    id: playerCharacter.id,
    title: playerCharacter.title,
    summary: playerCharacter.summary,
    status: playerCharacter.status,
    concept: playerCharacter.concept,
    partyRole: normalizeText(playerCharacter.partyRole),
  };
}

export function listCampaignV2PlayerCharacters(
  source: CampaignV2CharacterResolverSource,
): CampaignV2PlayerCharacterSummaryViewModel[] {
  return (source.playerCharacters ?? [])
    .map(toSummaryViewModel)
    .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
}

export function buildCampaignV2PlayerCharacterDetail(
  source: CampaignV2CharacterResolverSource,
  playerCharacterId: string,
): CampaignV2PlayerCharacterDetailPayload | null {
  const context = createContext(source);
  const playerCharacter = context.playerCharactersById.get(playerCharacterId);
  if (!playerCharacter) {
    return null;
  }

  const currentLocationId = playerCharacter.currentSituation?.currentLocationId ?? null;
  const currentLocation = currentLocationId ? context.locationsById.get(currentLocationId) ?? null : null;

  return {
    projectId: context.projectId,
    loadedAt: context.loadedAt,
    playerCharacter: {
      id: playerCharacter.id,
      title: playerCharacter.title,
      summary: playerCharacter.summary,
      status: playerCharacter.status,
      concept: playerCharacter.concept,
      partyRole: normalizeText(playerCharacter.partyRole),
      ancestry: normalizeText(playerCharacter.ancestry),
      characterClass: normalizeText(playerCharacter.class),
      age: typeof playerCharacter.age === 'number' ? playerCharacter.age : null,
      background: {
        origin: normalizeText(playerCharacter.background?.origin),
        history: normalizeText(playerCharacter.background?.history),
        incitingIncident: normalizeText(playerCharacter.background?.incitingIncident),
        reasonInCity: normalizeText(playerCharacter.background?.reasonInCity),
      },
      currentSituation: {
        overview: normalizeText(playerCharacter.currentSituation?.overview),
        legalStatus: normalizeText(playerCharacter.currentSituation?.legalStatus),
        socialStatus: normalizeText(playerCharacter.currentSituation?.socialStatus),
        currentProblem: normalizeText(playerCharacter.currentSituation?.currentProblem),
        currentLocationId,
        currentLocationTitle: currentLocation?.title ?? null,
        currentLocationHref: currentLocationId ? buildLocationHref(context.projectId, currentLocationId) : null,
      },
      goals: {
        shortTerm: normalizeText(playerCharacter.goals?.shortTerm),
        midTerm: normalizeText(playerCharacter.goals?.midTerm),
        longTerm: normalizeText(playerCharacter.goals?.longTerm),
      },
      traits: {
        strengths: sanitizeStringArray(playerCharacter.traits?.strengths),
        flaws: sanitizeStringArray(playerCharacter.traits?.flaws),
        personality: sanitizeStringArray(playerCharacter.traits?.personality),
      },
      spotlight: {
        themes: sanitizeStringArray(playerCharacter.spotlight?.themes),
        gmNotes: normalizeText(playerCharacter.spotlight?.gmNotes),
      },
      campaignFitSummary: playerCharacter.campaignFitSummary,
      startingThreads: (playerCharacter.startingThreadIds ?? []).map((threadId) =>
        toThreadViewModel(context.projectId, threadId, context.legacyThreadsById.get(threadId) ?? null),
      ),
      coreThreads: (playerCharacter.coreThreadIds ?? []).map((threadId) =>
        toThreadViewModel(context.projectId, threadId, context.legacyThreadsById.get(threadId) ?? null),
      ),
      relations: buildRelationViewModels(context, playerCharacter),
      linkedEntities: buildLinkedEntities(context, playerCharacter),
      relationshipNotes: (playerCharacter.relationshipNotes ?? []).map((entry) => ({
        label: entry.label,
        role: entry.role,
        note: normalizeText(entry.note),
      })),
      assets: {
        signatureItems: sanitizeStringArray(playerCharacter.assets?.signatureItems),
        specialCapabilities: sanitizeStringArray(playerCharacter.assets?.specialCapabilities),
      },
      connections: buildConnectionLinks(context, playerCharacter),
      notes: normalizeText(playerCharacter.notes),
    },
    diagnosticMessages: [...context.diagnostics],
  };
}
