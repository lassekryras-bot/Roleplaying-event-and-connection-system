import type {
  Hook,
  Place,
  Session,
  ThreadRef,
  Timeline,
} from '@/generated/gm-timeline';

import type { GmTimelineContentKind, GmTimelineDiagnostic } from './errors';
import {
  createGmTimelineLoader,
  type GmTimelineLoadedFile,
  type GmTimelineLoaderOptions,
  type GmTimelineLoadResult,
} from './loader';

export type GmTimelineTimelineView = {
  timeline: Timeline;
  sessions: Session[];
};

export type GmTimelineSessionView = {
  session: Session;
  places: Place[];
};

export type GmTimelineHookView = {
  hook: Hook;
  threads: ThreadRef[];
};

type SearchEntry<T> = {
  value: T;
  haystack: string;
};

type GmTimelineSnapshot = {
  projectId: string;
  loadedAt: Date | null;
  timeline: GmTimelineLoadedFile<Timeline> | null;
  sessionsById: Map<string, Session>;
  sessionPathsById: Map<string, string>;
  placesById: Map<string, Place>;
  placePathsById: Map<string, string>;
  hooksById: Map<string, Hook>;
  hookPathsById: Map<string, string>;
  threadRefsById: Map<string, ThreadRef>;
  threadRefPathsById: Map<string, string>;
  placeIdsBySessionId: Map<string, string[]>;
  hookIdsByPlaceId: Map<string, string[]>;
  threadIdsByHookId: Map<string, string[]>;
  diagnostics: GmTimelineDiagnostic[];
  sessionSearchEntries: Array<SearchEntry<Session>>;
  placeSearchEntries: Array<SearchEntry<Place>>;
  hookSearchEntries: Array<SearchEntry<Hook>>;
};

export type GmTimelineStore = {
  refresh(): Promise<void>;
  getDiagnostics(): GmTimelineDiagnostic[];
  getTimeline(): GmTimelineTimelineView | null;
  getSessionById(id: string): GmTimelineSessionView | null;
  getPlacesForSession(sessionId: string): Place[];
  getHooksForPlace(placeId: string): GmTimelineHookView[];
  searchSessions(query: string): Session[];
  searchPlaces(query: string): Place[];
  searchHooks(query: string): Hook[];
};

function createEmptySnapshot(projectId: string): GmTimelineSnapshot {
  return {
    projectId,
    loadedAt: null,
    timeline: null,
    sessionsById: new Map(),
    sessionPathsById: new Map(),
    placesById: new Map(),
    placePathsById: new Map(),
    hooksById: new Map(),
    hookPathsById: new Map(),
    threadRefsById: new Map(),
    threadRefPathsById: new Map(),
    placeIdsBySessionId: new Map(),
    hookIdsByPlaceId: new Map(),
    threadIdsByHookId: new Map(),
    diagnostics: [],
    sessionSearchEntries: [],
    placeSearchEntries: [],
    hookSearchEntries: [],
  };
}

function buildSearchEntries<T>(items: Iterable<T>, toHaystack: (item: T) => string): Array<SearchEntry<T>> {
  return [...items].map((value) => ({
    value,
    haystack: toHaystack(value).toLowerCase(),
  }));
}

function sortSessions(left: Session, right: Session) {
  return left.sequence - right.sequence || left.headline.localeCompare(right.headline);
}

function sortByHeadline<T extends { headline: string }>(left: T, right: T) {
  return left.headline.localeCompare(right.headline);
}

function createReferenceDiagnostic(
  projectId: string,
  contentKind: GmTimelineContentKind,
  relativePath: string,
  message: string,
): GmTimelineDiagnostic {
  return {
    code: 'REFERENCE_ERROR',
    projectId,
    contentKind,
    relativePath,
    message,
  };
}

function toUniqueMap<T extends { id: string }>(
  files: Array<GmTimelineLoadedFile<T>>,
): {
  valuesById: Map<string, T>;
  pathsById: Map<string, string>;
} {
  const valuesById = new Map<string, T>();
  const pathsById = new Map<string, string>();

  for (const file of files) {
    valuesById.set(file.value.id, file.value);
    pathsById.set(file.value.id, file.relativePath);
  }

  return {
    valuesById,
    pathsById,
  };
}

function normalizeLoadResult(loadResult: GmTimelineLoadResult) {
  const snapshot = createEmptySnapshot(loadResult.projectId);
  snapshot.loadedAt = loadResult.loadedAt;
  snapshot.timeline = loadResult.timeline;
  snapshot.diagnostics = [...loadResult.diagnostics];

  const sessionMaps = toUniqueMap(loadResult.sessions);
  const placeMaps = toUniqueMap(loadResult.places);
  const hookMaps = toUniqueMap(loadResult.hooks);
  const threadRefMaps = toUniqueMap(loadResult.threadRefs);

  snapshot.sessionsById = sessionMaps.valuesById;
  snapshot.sessionPathsById = sessionMaps.pathsById;
  snapshot.placesById = placeMaps.valuesById;
  snapshot.placePathsById = placeMaps.pathsById;
  snapshot.hooksById = hookMaps.valuesById;
  snapshot.hookPathsById = hookMaps.pathsById;
  snapshot.threadRefsById = threadRefMaps.valuesById;
  snapshot.threadRefPathsById = threadRefMaps.pathsById;

  if (loadResult.timeline) {
    for (const sessionId of loadResult.timeline.value.sessionIds) {
      if (snapshot.sessionsById.has(sessionId)) {
        continue;
      }

      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          loadResult.projectId,
          'timeline',
          loadResult.timeline.relativePath,
          `Timeline references missing session ${sessionId}.`,
        ),
      );
    }
  }

  for (const session of snapshot.sessionsById.values()) {
    const sessionPath = snapshot.sessionPathsById.get(session.id) ?? 'sessions/unknown.json';
    const resolvedPlaceIds: string[] = [];

    for (const placeId of session.placeIds) {
      if (snapshot.placesById.has(placeId)) {
        resolvedPlaceIds.push(placeId);
        continue;
      }

      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          loadResult.projectId,
          'session',
          sessionPath,
          `Session ${session.id} references missing place ${placeId}.`,
        ),
      );
    }

    snapshot.placeIdsBySessionId.set(session.id, resolvedPlaceIds);
  }

  for (const place of snapshot.placesById.values()) {
    const placePath = snapshot.placePathsById.get(place.id) ?? 'places/unknown.json';
    const resolvedHookIds: string[] = [];

    for (const hookId of place.hookIds) {
      if (snapshot.hooksById.has(hookId)) {
        resolvedHookIds.push(hookId);
        continue;
      }

      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          loadResult.projectId,
          'place',
          placePath,
          `Place ${place.id} references missing hook ${hookId}.`,
        ),
      );
    }

    snapshot.hookIdsByPlaceId.set(place.id, resolvedHookIds);
  }

  for (const hook of snapshot.hooksById.values()) {
    const hookPath = snapshot.hookPathsById.get(hook.id) ?? 'hooks/unknown.json';
    const resolvedThreadIds: string[] = [];

    for (const threadId of hook.threadIds) {
      if (snapshot.threadRefsById.has(threadId)) {
        resolvedThreadIds.push(threadId);
        continue;
      }

      snapshot.diagnostics.push(
        createReferenceDiagnostic(
          loadResult.projectId,
          'hook',
          hookPath,
          `Hook ${hook.id} references missing thread ${threadId}.`,
        ),
      );
    }

    snapshot.threadIdsByHookId.set(hook.id, resolvedThreadIds);
  }

  snapshot.sessionSearchEntries = buildSearchEntries(snapshot.sessionsById.values(), (session) =>
    [session.id, session.headline, session.summary ?? '', session.expectedDirection ?? '', session.notes ?? ''].join(
      ' ',
    ),
  );
  snapshot.placeSearchEntries = buildSearchEntries(snapshot.placesById.values(), (place) =>
    [place.id, place.headline, place.description, ...(place.tags ?? []), place.notes ?? ''].join(' '),
  );
  snapshot.hookSearchEntries = buildSearchEntries(snapshot.hooksById.values(), (hook) =>
    [hook.id, hook.headline, hook.description, hook.notes ?? ''].join(' '),
  );

  return snapshot;
}

function searchEntries<T>(entries: Array<SearchEntry<T>>, query: string, comparator: (left: T, right: T) => number): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return entries
    .filter((entry) => normalizedQuery.length === 0 || entry.haystack.includes(normalizedQuery))
    .map((entry) => entry.value)
    .sort(comparator);
}

export async function createGmTimelineStore(options: GmTimelineLoaderOptions): Promise<GmTimelineStore> {
  const loader = await createGmTimelineLoader(options);
  let snapshot = createEmptySnapshot(options.projectId);

  async function refresh() {
    const nextSnapshot = normalizeLoadResult(await loader.load());
    snapshot = nextSnapshot;
  }

  await refresh();

  return {
    refresh,
    getDiagnostics() {
      return [...snapshot.diagnostics];
    },
    getTimeline() {
      if (!snapshot.timeline) {
        return null;
      }

      const sessions = snapshot.timeline.value.sessionIds
        .map((sessionId) => snapshot.sessionsById.get(sessionId) ?? null)
        .filter((session): session is Session => session !== null);

      return {
        timeline: snapshot.timeline.value,
        sessions,
      };
    },
    getSessionById(id) {
      const session = snapshot.sessionsById.get(id);
      if (!session) {
        return null;
      }

      return {
        session,
        places: (snapshot.placeIdsBySessionId.get(id) ?? [])
          .map((placeId) => snapshot.placesById.get(placeId) ?? null)
          .filter((place): place is Place => place !== null),
      };
    },
    getPlacesForSession(sessionId) {
      return (snapshot.placeIdsBySessionId.get(sessionId) ?? [])
        .map((placeId) => snapshot.placesById.get(placeId) ?? null)
        .filter((place): place is Place => place !== null);
    },
    getHooksForPlace(placeId) {
      return (snapshot.hookIdsByPlaceId.get(placeId) ?? [])
        .map((hookId) => snapshot.hooksById.get(hookId) ?? null)
        .filter((hook): hook is Hook => hook !== null)
        .map((hook) => ({
          hook,
          threads: (snapshot.threadIdsByHookId.get(hook.id) ?? [])
            .map((threadId) => snapshot.threadRefsById.get(threadId) ?? null)
            .filter((thread): thread is ThreadRef => thread !== null),
        }));
    },
    searchSessions(query) {
      return searchEntries(snapshot.sessionSearchEntries, query, sortSessions);
    },
    searchPlaces(query) {
      return searchEntries(snapshot.placeSearchEntries, query, sortByHeadline);
    },
    searchHooks(query) {
      return searchEntries(snapshot.hookSearchEntries, query, sortByHeadline);
    },
  };
}
