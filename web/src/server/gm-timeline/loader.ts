import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  Hook,
  HookIndex,
  Place,
  PlaceIndex,
  Session,
  SessionIndex,
  ThreadIndex,
  ThreadRef,
  Timeline,
} from '@/generated/gm-timeline';

import type { GmTimelineContentKind, GmTimelineDiagnostic } from './errors';
import { createGmTimelineValidator, type GmTimelineValidator } from './validation';

export type GmTimelineLoaderOptions = {
  campaignsRoot?: string;
  schemaRoot?: string;
  projectId: string;
  contentSubdir?: string;
};

export type GmTimelineResolvedPaths = {
  campaignsRoot: string;
  schemaRoot: string;
  projectRoot: string;
  contentRoot: string;
};

export type GmTimelineLoadedFile<T> = {
  relativePath: string;
  value: T;
};

export type GmTimelineIndexes = {
  sessionIndex: GmTimelineLoadedFile<SessionIndex> | null;
  placeIndex: GmTimelineLoadedFile<PlaceIndex> | null;
  hookIndex: GmTimelineLoadedFile<HookIndex> | null;
  threadIndex: GmTimelineLoadedFile<ThreadIndex> | null;
};

export type GmTimelineLoadResult = {
  projectId: string;
  contentRoot: string;
  loadedAt: Date;
  timeline: GmTimelineLoadedFile<Timeline> | null;
  sessions: Array<GmTimelineLoadedFile<Session>>;
  places: Array<GmTimelineLoadedFile<Place>>;
  hooks: Array<GmTimelineLoadedFile<Hook>>;
  threadRefs: Array<GmTimelineLoadedFile<ThreadRef>>;
  indexes: GmTimelineIndexes;
  diagnostics: GmTimelineDiagnostic[];
};

export type GmTimelineLoader = {
  load(): Promise<GmTimelineLoadResult>;
};

const DEFAULT_CONTENT_SUBDIR = 'gm-timeline';

function getRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
}

export function resolveGmTimelinePaths(options: GmTimelineLoaderOptions): GmTimelineResolvedPaths {
  const repoRoot = getRepoRoot();
  const campaignsRoot = options.campaignsRoot ?? path.join(repoRoot, 'campaigns');
  const schemaRoot = options.schemaRoot ?? path.join(repoRoot, 'schemas', 'gm-timeline');
  const projectRoot = path.join(campaignsRoot, options.projectId);
  const contentRoot = path.join(projectRoot, options.contentSubdir ?? DEFAULT_CONTENT_SUBDIR);

  return {
    campaignsRoot,
    schemaRoot,
    projectRoot,
    contentRoot,
  };
}

type ReadValidatedFileResult<T> = {
  value: GmTimelineLoadedFile<T> | null;
  diagnostics: GmTimelineDiagnostic[];
};

function toFileReadDiagnostic(
  projectId: string,
  contentKind: GmTimelineContentKind,
  relativePath: string,
  error: unknown,
): GmTimelineDiagnostic {
  const message = error instanceof Error ? error.message : 'Unable to read file.';
  return {
    code: 'FILE_READ_ERROR',
    projectId,
    contentKind,
    relativePath,
    message,
  };
}

function toJsonParseDiagnostic(
  projectId: string,
  contentKind: GmTimelineContentKind,
  relativePath: string,
  error: unknown,
): GmTimelineDiagnostic {
  const message = error instanceof Error ? error.message : 'File contains invalid JSON.';
  return {
    code: 'JSON_PARSE_ERROR',
    projectId,
    contentKind,
    relativePath,
    message,
  };
}

async function readValidatedJsonFile<T>({
  filePath,
  relativePath,
  contentKind,
  projectId,
  validator,
  required,
}: {
  filePath: string;
  relativePath: string;
  contentKind: GmTimelineContentKind;
  projectId: string;
  validator: GmTimelineValidator;
  required: boolean;
}): Promise<ReadValidatedFileResult<T>> {
  let rawFileContents: string;

  try {
    rawFileContents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (!required && code === 'ENOENT') {
      return {
        value: null,
        diagnostics: [],
      };
    }

    return {
      value: null,
      diagnostics: [toFileReadDiagnostic(projectId, contentKind, relativePath, error)],
    };
  }

  let parsedContents: unknown;
  try {
    parsedContents = JSON.parse(rawFileContents);
  } catch (error) {
    return {
      value: null,
      diagnostics: [toJsonParseDiagnostic(projectId, contentKind, relativePath, error)],
    };
  }

  const validationResult = validator.validate(contentKind, parsedContents, {
    projectId,
    relativePath,
  });

  if (!validationResult.valid) {
    return {
      value: null,
      diagnostics: [validationResult.diagnostic],
    };
  }

  return {
    value: {
      relativePath,
      value: parsedContents as T,
    },
    diagnostics: [],
  };
}

async function loadJsonDirectory<T>({
  contentRoot,
  directoryName,
  contentKind,
  projectId,
  validator,
}: {
  contentRoot: string;
  directoryName: string;
  contentKind: GmTimelineContentKind;
  projectId: string;
  validator: GmTimelineValidator;
}): Promise<{
  files: Array<GmTimelineLoadedFile<T>>;
  diagnostics: GmTimelineDiagnostic[];
}> {
  const directoryPath = path.join(contentRoot, directoryName);
  let entries;

  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      return {
        files: [],
        diagnostics: [],
      };
    }

    return {
      files: [],
      diagnostics: [toFileReadDiagnostic(projectId, contentKind, directoryName, error)],
    };
  }

  const jsonEntries = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
    .sort((left, right) => left.name.localeCompare(right.name));

  const loadedFiles: Array<GmTimelineLoadedFile<T>> = [];
  const diagnostics: GmTimelineDiagnostic[] = [];

  for (const entry of jsonEntries) {
    const relativePath = path.posix.join(directoryName, entry.name);
    const filePath = path.join(directoryPath, entry.name);
    const result = await readValidatedJsonFile<T>({
      filePath,
      relativePath,
      contentKind,
      projectId,
      validator,
      required: false,
    });

    if (result.value) {
      loadedFiles.push(result.value);
    }
    diagnostics.push(...result.diagnostics);
  }

  return {
    files: loadedFiles,
    diagnostics,
  };
}

async function loadOptionalIndexFile<T>({
  contentRoot,
  directoryName,
  contentKind,
  projectId,
  validator,
}: {
  contentRoot: string;
  directoryName: string;
  contentKind: GmTimelineContentKind;
  projectId: string;
  validator: GmTimelineValidator;
}): Promise<ReadValidatedFileResult<T>> {
  const relativePath = path.posix.join(directoryName, 'index.json');
  return readValidatedJsonFile<T>({
    filePath: path.join(contentRoot, directoryName, 'index.json'),
    relativePath,
    contentKind,
    projectId,
    validator,
    required: false,
  });
}

export async function loadGmTimelineContent(
  options: GmTimelineLoaderOptions,
  validator?: GmTimelineValidator,
): Promise<GmTimelineLoadResult> {
  const { schemaRoot, contentRoot } = resolveGmTimelinePaths(options);
  const activeValidator = validator ?? (await createGmTimelineValidator(schemaRoot));
  const diagnostics: GmTimelineDiagnostic[] = [];

  const timelineResult = await readValidatedJsonFile<Timeline>({
    filePath: path.join(contentRoot, 'timeline.json'),
    relativePath: 'timeline.json',
    contentKind: 'timeline',
    projectId: options.projectId,
    validator: activeValidator,
    required: true,
  });
  diagnostics.push(...timelineResult.diagnostics);

  const sessionIndexResult = await loadOptionalIndexFile<SessionIndex>({
    contentRoot,
    directoryName: 'sessions',
    contentKind: 'sessionIndex',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...sessionIndexResult.diagnostics);

  const placeIndexResult = await loadOptionalIndexFile<PlaceIndex>({
    contentRoot,
    directoryName: 'places',
    contentKind: 'placeIndex',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...placeIndexResult.diagnostics);

  const hookIndexResult = await loadOptionalIndexFile<HookIndex>({
    contentRoot,
    directoryName: 'hooks',
    contentKind: 'hookIndex',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...hookIndexResult.diagnostics);

  const threadIndexResult = await loadOptionalIndexFile<ThreadIndex>({
    contentRoot,
    directoryName: 'threads',
    contentKind: 'threadIndex',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...threadIndexResult.diagnostics);

  const sessionsResult = await loadJsonDirectory<Session>({
    contentRoot,
    directoryName: 'sessions',
    contentKind: 'session',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...sessionsResult.diagnostics);

  const placesResult = await loadJsonDirectory<Place>({
    contentRoot,
    directoryName: 'places',
    contentKind: 'place',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...placesResult.diagnostics);

  const hooksResult = await loadJsonDirectory<Hook>({
    contentRoot,
    directoryName: 'hooks',
    contentKind: 'hook',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...hooksResult.diagnostics);

  const threadRefsResult = await loadJsonDirectory<ThreadRef>({
    contentRoot,
    directoryName: 'threads',
    contentKind: 'threadRef',
    projectId: options.projectId,
    validator: activeValidator,
  });
  diagnostics.push(...threadRefsResult.diagnostics);

  return {
    projectId: options.projectId,
    contentRoot,
    loadedAt: new Date(),
    timeline: timelineResult.value,
    sessions: sessionsResult.files,
    places: placesResult.files,
    hooks: hooksResult.files,
    threadRefs: threadRefsResult.files,
    indexes: {
      sessionIndex: sessionIndexResult.value,
      placeIndex: placeIndexResult.value,
      hookIndex: hookIndexResult.value,
      threadIndex: threadIndexResult.value,
    },
    diagnostics,
  };
}

export async function createGmTimelineLoader(options: GmTimelineLoaderOptions): Promise<GmTimelineLoader> {
  const { schemaRoot } = resolveGmTimelinePaths(options);
  const validator = await createGmTimelineValidator(schemaRoot);

  return {
    load() {
      return loadGmTimelineContent(options, validator);
    },
  };
}
