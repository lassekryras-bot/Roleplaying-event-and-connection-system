import type { Effect, Event, Location, LocationState, Npc, PlayerCharacter, Relation, Session } from '@/generated/campaign-v2';

import type { CampaignV2Diagnostic } from './errors';
import { loadCampaignLegacyThreads, type CampaignLegacyThreadSummary } from './legacy-threads';
import {
  createCampaignV2RelationGraph,
  type CampaignV2DocumentRecordMap,
  type CampaignV2ObjectRecord,
  type CampaignV2RelationGraph,
  type CampaignV2RelationType,
  type CampaignV2RelatedObject,
} from './relations';
import {
  loadCampaignV2Content,
  saveEffect as writeEffect,
  saveEvent as writeEvent,
  saveLocation as writeLocation,
  saveLocationState as writeLocationState,
  saveNpc as writeNpc,
  savePlayerCharacter as writePlayerCharacter,
  saveSession as writeSession,
  type CampaignV2LoadResult,
  type CampaignV2LoadedFile,
  type CampaignV2StorageOptions,
} from './storage';

type CampaignV2Snapshot = {
  projectId: string;
  loadedAt: Date | null;
  locationsById: Map<string, CampaignV2DocumentRecordMap['location']>;
  locationStatesById: Map<string, CampaignV2DocumentRecordMap['locationState']>;
  sessionsById: Map<string, CampaignV2DocumentRecordMap['session']>;
  eventsById: Map<string, CampaignV2DocumentRecordMap['event']>;
  effectsById: Map<string, CampaignV2DocumentRecordMap['effect']>;
  playerCharactersById: Map<string, CampaignV2DocumentRecordMap['playerCharacter']>;
  npcsById: Map<string, CampaignV2DocumentRecordMap['npc']>;
  legacyThreadsById: Map<string, CampaignLegacyThreadSummary>;
  relationGraph: CampaignV2RelationGraph;
  diagnostics: CampaignV2Diagnostic[];
};

export type CampaignV2StoreSnapshot = {
  projectId: string;
  loadedAt: Date | null;
  locations: CampaignV2DocumentRecordMap['location'][];
  locationStates: CampaignV2DocumentRecordMap['locationState'][];
  sessions: CampaignV2DocumentRecordMap['session'][];
  events: CampaignV2DocumentRecordMap['event'][];
  effects: CampaignV2DocumentRecordMap['effect'][];
  playerCharacters: CampaignV2DocumentRecordMap['playerCharacter'][];
  npcs: CampaignV2DocumentRecordMap['npc'][];
  diagnostics: CampaignV2Diagnostic[];
};

export type CampaignV2Store = {
  refresh(): Promise<void>;
  getDiagnostics(): CampaignV2Diagnostic[];
  getSnapshot(): CampaignV2StoreSnapshot;
  getRelationGraph(): CampaignV2RelationGraph;
  getRelationsByType(
    objectOrId: string | Pick<CampaignV2ObjectRecord, 'id' | 'relations'>,
    relationType: CampaignV2RelationType,
  ): Relation[];
  resolveTarget(relation: Relation): CampaignV2ObjectRecord | null;
  getObjectsRelatedTo(id: string): CampaignV2RelatedObject[];
  saveLocation(location: Location): Promise<CampaignV2DocumentRecordMap['location']>;
  saveLocationState(locationState: LocationState): Promise<CampaignV2DocumentRecordMap['locationState']>;
  saveSession(session: Session): Promise<CampaignV2DocumentRecordMap['session']>;
  saveEvent(event: Event): Promise<CampaignV2DocumentRecordMap['event']>;
  saveEffect(effect: Effect): Promise<CampaignV2DocumentRecordMap['effect']>;
  savePlayerCharacter(playerCharacter: PlayerCharacter): Promise<CampaignV2DocumentRecordMap['playerCharacter']>;
  saveNpc(npc: Npc): Promise<CampaignV2DocumentRecordMap['npc']>;
  getLocation(id: string): CampaignV2DocumentRecordMap['location'] | null;
  getLocationState(id: string): CampaignV2DocumentRecordMap['locationState'] | null;
  getSession(id: string): CampaignV2DocumentRecordMap['session'] | null;
  getEvent(id: string): CampaignV2DocumentRecordMap['event'] | null;
  getEffect(id: string): CampaignV2DocumentRecordMap['effect'] | null;
  getPlayerCharacter(id: string): CampaignV2DocumentRecordMap['playerCharacter'] | null;
  getNpc(id: string): CampaignV2DocumentRecordMap['npc'] | null;
  listLocations(): CampaignV2DocumentRecordMap['location'][];
  listLocationStates(): CampaignV2DocumentRecordMap['locationState'][];
  listSessions(): CampaignV2DocumentRecordMap['session'][];
  listEvents(): CampaignV2DocumentRecordMap['event'][];
  listEffects(): CampaignV2DocumentRecordMap['effect'][];
  listPlayerCharacters(): CampaignV2DocumentRecordMap['playerCharacter'][];
  listNpcs(): CampaignV2DocumentRecordMap['npc'][];
};

function createEmptySnapshot(projectId: string): CampaignV2Snapshot {
  return {
    projectId,
    loadedAt: null,
    locationsById: new Map(),
    locationStatesById: new Map(),
    sessionsById: new Map(),
    eventsById: new Map(),
    effectsById: new Map(),
    playerCharactersById: new Map(),
    npcsById: new Map(),
    legacyThreadsById: new Map(),
    relationGraph: createCampaignV2RelationGraph({}),
    diagnostics: [],
  };
}

function toUniqueMap<T extends { id: string }>(files: Array<CampaignV2LoadedFile<T>>) {
  return new Map(files.map((file) => [file.value.id, file.value]));
}

function sortByTitle<T extends { title: string }>(left: T, right: T) {
  return left.title.localeCompare(right.title);
}

function sortSessions(left: Session, right: Session) {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function createReferenceDiagnostic(
  contentKind: CampaignV2Diagnostic['contentKind'],
  sourceName: string,
  message: string,
): CampaignV2Diagnostic {
  return {
    code: 'REFERENCE_ERROR',
    contentKind,
    sourceName,
    message,
    issues: [],
  };
}

function toLegacyThreadMap(threads: CampaignLegacyThreadSummary[]) {
  return new Map(threads.map((thread) => [thread.id, thread]));
}

function validateCurrentLocationReference(
  snapshot: CampaignV2Snapshot,
  contentKind: CampaignV2Diagnostic['contentKind'],
  sourceName: string,
  object: { id: string; currentSituation?: { currentLocationId?: string | null } },
) {
  const locationId = object.currentSituation?.currentLocationId;
  if (!locationId || snapshot.locationsById.has(locationId)) {
    return;
  }

  snapshot.diagnostics.push(
    createReferenceDiagnostic(
      contentKind,
      sourceName,
      `${contentKind} ${object.id} references missing location ${locationId} in currentSituation.currentLocationId.`,
    ),
  );
}

function validateThreadIds(
  snapshot: CampaignV2Snapshot,
  contentKind: CampaignV2Diagnostic['contentKind'],
  sourceName: string,
  object: { id: string },
  threadIds: readonly string[] | undefined,
  fieldName: 'startingThreadIds' | 'coreThreadIds',
) {
  for (const threadId of threadIds ?? []) {
    if (snapshot.legacyThreadsById.has(threadId)) {
      continue;
    }

    snapshot.diagnostics.push(
      createReferenceDiagnostic(
        contentKind,
        sourceName,
        `${contentKind} ${object.id} references missing legacy thread ${threadId} in ${fieldName}.`,
      ),
    );
  }
}

function validateRelationTargets(
  snapshot: CampaignV2Snapshot,
  contentKind: CampaignV2Diagnostic['contentKind'],
  sourceName: string,
  object: Pick<CampaignV2ObjectRecord, 'id' | 'type' | 'relations'>,
) {
  for (const relation of object.relations) {
    if (snapshot.relationGraph.resolveTarget(relation)) {
      continue;
    }

    snapshot.diagnostics.push(
      createReferenceDiagnostic(
        contentKind,
        sourceName,
        `${object.type} ${object.id} relation ${relation.type} references missing target ${relation.targetId}.`,
      ),
    );
  }
}

function normalizeLoadResult(loadResult: CampaignV2LoadResult, legacyThreads: CampaignLegacyThreadSummary[]): CampaignV2Snapshot {
  const snapshot = createEmptySnapshot(loadResult.projectId);
  snapshot.loadedAt = loadResult.loadedAt;
  snapshot.diagnostics = [...loadResult.diagnostics];
  snapshot.locationsById = toUniqueMap(loadResult.locations);
  snapshot.locationStatesById = toUniqueMap(loadResult.locationStates);
  snapshot.sessionsById = toUniqueMap(loadResult.sessions);
  snapshot.eventsById = toUniqueMap(loadResult.events);
  snapshot.effectsById = toUniqueMap(loadResult.effects);
  snapshot.playerCharactersById = toUniqueMap(loadResult.playerCharacters);
  snapshot.npcsById = toUniqueMap(loadResult.npcs);
  snapshot.legacyThreadsById = toLegacyThreadMap(legacyThreads);
  snapshot.relationGraph = createCampaignV2RelationGraph({
    locations: [...snapshot.locationsById.values()],
    locationStates: [...snapshot.locationStatesById.values()],
    sessions: [...snapshot.sessionsById.values()],
    events: [...snapshot.eventsById.values()],
    effects: [...snapshot.effectsById.values()],
    playerCharacters: [...snapshot.playerCharactersById.values()],
    npcs: [...snapshot.npcsById.values()],
  });

  for (const file of loadResult.locationStates) {
    const locationState = file.value;
    if (!snapshot.locationsById.has(locationState.locationId)) {
      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          'locationState',
          file.relativePath,
          `Location state ${locationState.id} references missing location ${locationState.locationId}.`,
        ),
      );
    }
  }

  for (const file of loadResult.sessions) {
    const session = file.value;
    if (!snapshot.locationsById.has(session.locationId)) {
      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          'session',
          file.relativePath,
          `Session ${session.id} references missing location ${session.locationId}.`,
        ),
      );
    }

    for (const locationStateId of [session.startingLocationStateId, session.resultingLocationStateId]) {
      if (locationStateId && !snapshot.locationStatesById.has(locationStateId)) {
        snapshot.diagnostics.push(
          createReferenceDiagnostic(
            'session',
            file.relativePath,
            `Session ${session.id} references missing location state ${locationStateId}.`,
          ),
        );
      }
    }
  }

  for (const file of loadResult.events) {
    const event = file.value;
    for (const effectId of event.createdEffectIds ?? []) {
      if (!snapshot.effectsById.has(effectId)) {
        snapshot.diagnostics.push(
          createReferenceDiagnostic('event', file.relativePath, `Event ${event.id} references missing effect ${effectId}.`),
        );
      }
    }
  }

  for (const file of loadResult.locations) {
    validateRelationTargets(snapshot, 'location', file.relativePath, file.value);
  }

  for (const file of loadResult.locationStates) {
    validateRelationTargets(snapshot, 'locationState', file.relativePath, file.value);
  }

  for (const file of loadResult.sessions) {
    validateRelationTargets(snapshot, 'session', file.relativePath, file.value);
  }

  for (const file of loadResult.events) {
    validateRelationTargets(snapshot, 'event', file.relativePath, file.value);
  }

  for (const file of loadResult.effects) {
    validateRelationTargets(snapshot, 'effect', file.relativePath, file.value);
  }

  for (const file of loadResult.playerCharacters) {
    validateCurrentLocationReference(snapshot, 'playerCharacter', file.relativePath, file.value);
    validateThreadIds(snapshot, 'playerCharacter', file.relativePath, file.value, file.value.startingThreadIds, 'startingThreadIds');
    validateThreadIds(snapshot, 'playerCharacter', file.relativePath, file.value, file.value.coreThreadIds, 'coreThreadIds');
    validateRelationTargets(snapshot, 'playerCharacter', file.relativePath, file.value);
  }

  for (const file of loadResult.npcs) {
    validateCurrentLocationReference(snapshot, 'npc', file.relativePath, file.value);
    validateThreadIds(snapshot, 'npc', file.relativePath, file.value, file.value.startingThreadIds, 'startingThreadIds');
    validateThreadIds(snapshot, 'npc', file.relativePath, file.value, file.value.coreThreadIds, 'coreThreadIds');
    validateRelationTargets(snapshot, 'npc', file.relativePath, file.value);
  }

  return snapshot;
}

function toStoreSnapshot(snapshot: CampaignV2Snapshot): CampaignV2StoreSnapshot {
  return {
    projectId: snapshot.projectId,
    loadedAt: snapshot.loadedAt,
    locations: [...snapshot.locationsById.values()].sort(sortByTitle),
    locationStates: [...snapshot.locationStatesById.values()].sort(sortByTitle),
    sessions: [...snapshot.sessionsById.values()].sort(sortSessions),
    events: [...snapshot.eventsById.values()].sort(sortByTitle),
    effects: [...snapshot.effectsById.values()].sort(sortByTitle),
    playerCharacters: [...snapshot.playerCharactersById.values()].sort(sortByTitle),
    npcs: [...snapshot.npcsById.values()].sort(sortByTitle),
    diagnostics: [...snapshot.diagnostics],
  };
}

export async function createCampaignV2Store(options: CampaignV2StorageOptions): Promise<CampaignV2Store> {
  let snapshot = createEmptySnapshot(options.projectId);

  async function refresh() {
    const loadResult = await loadCampaignV2Content(options);
    const legacyThreads = await loadCampaignLegacyThreads(options);
    snapshot = normalizeLoadResult(loadResult, legacyThreads);
  }

  await refresh();

  return {
    refresh,
    getDiagnostics() {
      return [...snapshot.diagnostics];
    },
    getRelationGraph() {
      return snapshot.relationGraph;
    },
    getRelationsByType(objectOrId, relationType) {
      return snapshot.relationGraph.getRelationsByType(objectOrId, relationType);
    },
    resolveTarget(relation) {
      return snapshot.relationGraph.resolveTarget(relation);
    },
    getObjectsRelatedTo(id) {
      return snapshot.relationGraph.getObjectsRelatedTo(id);
    },
    getSnapshot() {
      return toStoreSnapshot(snapshot);
    },
    async saveLocation(location) {
      const savedLocation = await writeLocation(options, location);
      await refresh();
      return savedLocation;
    },
    async saveLocationState(locationState) {
      const savedLocationState = await writeLocationState(options, locationState);
      await refresh();
      return savedLocationState;
    },
    async saveSession(session) {
      const savedSession = await writeSession(options, session);
      await refresh();
      return savedSession;
    },
    async saveEvent(event) {
      const savedEvent = await writeEvent(options, event);
      await refresh();
      return savedEvent;
    },
    async saveEffect(effect) {
      const savedEffect = await writeEffect(options, effect);
      await refresh();
      return savedEffect;
    },
    async savePlayerCharacter(playerCharacter) {
      const savedPlayerCharacter = await writePlayerCharacter(options, playerCharacter);
      await refresh();
      return savedPlayerCharacter;
    },
    async saveNpc(npc) {
      const savedNpc = await writeNpc(options, npc);
      await refresh();
      return savedNpc;
    },
    getLocation(id) {
      return snapshot.locationsById.get(id) ?? null;
    },
    getLocationState(id) {
      return snapshot.locationStatesById.get(id) ?? null;
    },
    getSession(id) {
      return snapshot.sessionsById.get(id) ?? null;
    },
    getEvent(id) {
      return snapshot.eventsById.get(id) ?? null;
    },
    getEffect(id) {
      return snapshot.effectsById.get(id) ?? null;
    },
    getPlayerCharacter(id) {
      return snapshot.playerCharactersById.get(id) ?? null;
    },
    getNpc(id) {
      return snapshot.npcsById.get(id) ?? null;
    },
    listLocations() {
      return toStoreSnapshot(snapshot).locations;
    },
    listLocationStates() {
      return toStoreSnapshot(snapshot).locationStates;
    },
    listSessions() {
      return toStoreSnapshot(snapshot).sessions;
    },
    listEvents() {
      return toStoreSnapshot(snapshot).events;
    },
    listEffects() {
      return toStoreSnapshot(snapshot).effects;
    },
    listPlayerCharacters() {
      return toStoreSnapshot(snapshot).playerCharacters;
    },
    listNpcs() {
      return toStoreSnapshot(snapshot).npcs;
    },
  };
}
