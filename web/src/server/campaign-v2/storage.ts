import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Effect, Event, Location, LocationState, Session } from '@/generated/campaign-v2';

import type { CampaignV2ContentKind, CampaignV2Diagnostic } from './errors';
import { formatCampaignV2Diagnostic } from './errors';
import { normalizeCampaignV2Document, type CampaignV2DocumentRecordMap } from './relations';
import { createCampaignV2Validator, type CampaignV2Validator } from './validation';

type CampaignV2DocumentKind = Exclude<CampaignV2ContentKind, 'relation'>;

type CampaignV2RawDocumentMap = {
  location: Location;
  locationState: LocationState;
  session: Session;
  event: Event;
  effect: Effect;
};

type ReadValidatedFileResult<T> = {
  value: CampaignV2LoadedFile<T> | null;
  diagnostics: CampaignV2Diagnostic[];
};

type CampaignV2StorageCommandOptions = CampaignV2StorageOptions & {
  validator?: CampaignV2Validator;
};

export type CampaignV2StorageOptions = {
  campaignsRoot?: string;
  schemaRoot?: string;
  projectId: string;
  contentSubdir?: string;
};

export type CampaignV2ResolvedPaths = {
  campaignsRoot: string;
  schemaRoot: string;
  projectRoot: string;
  contentRoot: string;
  locationsDir: string;
  locationStatesDir: string;
  sessionsDir: string;
  eventsDir: string;
  effectsDir: string;
};

export type CampaignV2LoadedFile<T> = {
  relativePath: string;
  value: T;
};

export type CampaignV2LoadResult = {
  projectId: string;
  contentRoot: string;
  loadedAt: Date;
  locations: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap['location']>>;
  locationStates: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap['locationState']>>;
  sessions: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap['session']>>;
  events: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap['event']>>;
  effects: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap['effect']>>;
  diagnostics: CampaignV2Diagnostic[];
};

export const CAMPAIGN_V2_DIRECTORY_BY_KIND: Record<CampaignV2DocumentKind, string> = {
  location: 'locations',
  locationState: 'location-states',
  session: 'sessions',
  event: 'events',
  effect: 'effects',
};

export const CAMPAIGN_V2_ID_PREFIX_BY_KIND: Record<CampaignV2DocumentKind, string> = {
  location: 'location-',
  locationState: 'location-state-',
  session: 'session-',
  event: 'event-',
  effect: 'effect-',
};

const DEFAULT_CONTENT_SUBDIR = 'campaign-v2';

function getRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
}

function createDiagnostic({
  code,
  contentKind,
  sourceName,
  message,
}: {
  code: CampaignV2Diagnostic['code'];
  contentKind: CampaignV2ContentKind;
  sourceName: string;
  message: string;
}): CampaignV2Diagnostic {
  return {
    code,
    contentKind,
    sourceName,
    message,
    issues: [],
  };
}

function toFileReadDiagnostic(
  contentKind: CampaignV2ContentKind,
  sourceName: string,
  error: unknown,
): CampaignV2Diagnostic {
  const message = error instanceof Error ? error.message : 'Unable to read file.';
  return createDiagnostic({
    code: 'FILE_READ_ERROR',
    contentKind,
    sourceName,
    message,
  });
}

function toJsonParseDiagnostic(
  contentKind: CampaignV2ContentKind,
  sourceName: string,
  error: unknown,
): CampaignV2Diagnostic {
  const message = error instanceof Error ? error.message : 'File contains invalid JSON.';
  return createDiagnostic({
    code: 'JSON_PARSE_ERROR',
    contentKind,
    sourceName,
    message,
  });
}

function toIdConventionDiagnostic(
  contentKind: CampaignV2DocumentKind,
  sourceName: string,
  message: string,
): CampaignV2Diagnostic {
  return createDiagnostic({
    code: 'ID_CONVENTION_ERROR',
    contentKind,
    sourceName,
    message,
  });
}

function resolveDocumentDirectory(kind: CampaignV2DocumentKind) {
  return CAMPAIGN_V2_DIRECTORY_BY_KIND[kind];
}

function resolveDocumentRelativePath(kind: CampaignV2DocumentKind, id: string) {
  return path.posix.join(resolveDocumentDirectory(kind), `${id}.json`);
}

function resolveDocumentFilePath(resolvedPaths: CampaignV2ResolvedPaths, kind: CampaignV2DocumentKind, id: string) {
  return path.join(resolvedPaths.contentRoot, resolveDocumentDirectory(kind), `${id}.json`);
}

function assertIdConvention(kind: CampaignV2DocumentKind, id: string, sourceName: string) {
  const prefix = CAMPAIGN_V2_ID_PREFIX_BY_KIND[kind];
  if (!id.startsWith(prefix)) {
    throw new Error(
      formatCampaignV2Diagnostic(
        toIdConventionDiagnostic(kind, sourceName, `Expected ${kind} ids to start with ${prefix}.`),
      ),
    );
  }
}

function assertFilenameMatchesId(kind: CampaignV2DocumentKind, sourceName: string, id: string) {
  const expectedFileName = `${id}.json`;
  if (path.posix.basename(sourceName) !== expectedFileName) {
    throw new Error(
      formatCampaignV2Diagnostic(
        toIdConventionDiagnostic(kind, sourceName, `Expected filename to be ${expectedFileName}.`),
      ),
    );
  }
}

async function writeJsonAtomically(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempFilePath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const contents = `${JSON.stringify(payload, null, 2)}\n`;

  try {
    await fs.writeFile(tempFilePath, contents, 'utf8');
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    await fs.rm(tempFilePath, { force: true });
    throw error;
  }
}

async function getValidator(options: CampaignV2StorageCommandOptions) {
  return options.validator ?? createCampaignV2Validator(resolveCampaignV2Paths(options).schemaRoot);
}

async function readValidatedJsonFile<T extends { id: string }>({
  filePath,
  relativePath,
  contentKind,
  validator,
  required,
}: {
  filePath: string;
  relativePath: string;
  contentKind: CampaignV2DocumentKind;
  validator: CampaignV2Validator;
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
      diagnostics: [toFileReadDiagnostic(contentKind, relativePath, error)],
    };
  }

  let parsedContents: unknown;
  try {
    parsedContents = JSON.parse(rawFileContents);
  } catch (error) {
    return {
      value: null,
      diagnostics: [toJsonParseDiagnostic(contentKind, relativePath, error)],
    };
  }

  const validationResult = validator.validate(contentKind, parsedContents, {
    sourceName: relativePath,
  });

  if (!validationResult.valid) {
    return {
      value: null,
      diagnostics: [validationResult.diagnostic],
    };
  }

  const document = normalizeCampaignV2Document(
    parsedContents as CampaignV2RawDocumentMap[typeof contentKind],
  ) as unknown as T;
  if (path.posix.basename(relativePath) !== `${document.id}.json`) {
    return {
      value: null,
      diagnostics: [
        toIdConventionDiagnostic(
          contentKind,
          relativePath,
          `Expected filename to be ${document.id}.json for ${contentKind} ${document.id}.`,
        ),
      ],
    };
  }

  return {
    value: {
      relativePath,
      value: document,
    },
    diagnostics: [],
  };
}

async function loadJsonDirectory<K extends CampaignV2DocumentKind>({
  contentRoot,
  directoryName,
  contentKind,
  validator,
}: {
  contentRoot: string;
  directoryName: string;
  contentKind: K;
  validator: CampaignV2Validator;
}): Promise<{
  files: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap[K]>>;
  diagnostics: CampaignV2Diagnostic[];
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
      diagnostics: [toFileReadDiagnostic(contentKind, directoryName, error)],
    };
  }

  const jsonEntries = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));

  const files: Array<CampaignV2LoadedFile<CampaignV2DocumentRecordMap[K]>> = [];
  const diagnostics: CampaignV2Diagnostic[] = [];

  for (const entry of jsonEntries) {
    const relativePath = path.posix.join(directoryName, entry.name);
    const result = await readValidatedJsonFile<CampaignV2DocumentRecordMap[K]>({
      filePath: path.join(directoryPath, entry.name),
      relativePath,
      contentKind,
      validator,
      required: false,
    });

    if (result.value) {
      files.push(result.value);
    }

    diagnostics.push(...result.diagnostics);
  }

  return {
    files,
    diagnostics,
  };
}

async function saveDocument<K extends CampaignV2DocumentKind>(
  options: CampaignV2StorageCommandOptions,
  contentKind: K,
  document: CampaignV2RawDocumentMap[K],
): Promise<CampaignV2DocumentRecordMap[K]> {
  const resolvedPaths = resolveCampaignV2Paths(options);
  const validator = await getValidator(options);
  const normalizedDocument = normalizeCampaignV2Document(document);
  const relativePath = resolveDocumentRelativePath(contentKind, normalizedDocument.id);

  assertIdConvention(contentKind, normalizedDocument.id, relativePath);
  assertFilenameMatchesId(contentKind, relativePath, normalizedDocument.id);

  const validationResult = validator.validate(contentKind, normalizedDocument, {
    sourceName: relativePath,
  });
  if (!validationResult.valid) {
    throw new Error(formatCampaignV2Diagnostic(validationResult.diagnostic));
  }

  await writeJsonAtomically(resolveDocumentFilePath(resolvedPaths, contentKind, normalizedDocument.id), normalizedDocument);
  return normalizedDocument;
}

async function getDocument<K extends CampaignV2DocumentKind>(
  options: CampaignV2StorageCommandOptions,
  contentKind: K,
  id: string,
): Promise<CampaignV2DocumentRecordMap[K] | null> {
  const resolvedPaths = resolveCampaignV2Paths(options);
  const validator = await getValidator(options);
  const relativePath = resolveDocumentRelativePath(contentKind, id);

  assertIdConvention(contentKind, id, relativePath);

  const result = await readValidatedJsonFile<CampaignV2DocumentRecordMap[K]>({
    filePath: resolveDocumentFilePath(resolvedPaths, contentKind, id),
    relativePath,
    contentKind,
    validator,
    required: false,
  });

  if (result.diagnostics.length > 0) {
    return null;
  }

  return result.value?.value ?? null;
}

async function listDocuments<K extends CampaignV2DocumentKind>(
  options: CampaignV2StorageCommandOptions,
  contentKind: K,
): Promise<Array<CampaignV2DocumentRecordMap[K]>> {
  const resolvedPaths = resolveCampaignV2Paths(options);
  const validator = await getValidator(options);
  const result = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: resolveDocumentDirectory(contentKind),
    contentKind,
    validator,
  });

  return result.files.map((file) => file.value);
}

export function resolveCampaignV2Paths(options: CampaignV2StorageOptions): CampaignV2ResolvedPaths {
  const repoRoot = getRepoRoot();
  const campaignsRoot = options.campaignsRoot ?? path.join(repoRoot, 'campaigns');
  const schemaRoot = options.schemaRoot ?? path.join(repoRoot, 'schemas', 'campaign-v2');
  const projectRoot = path.join(campaignsRoot, options.projectId);
  const contentRoot = path.join(projectRoot, options.contentSubdir ?? DEFAULT_CONTENT_SUBDIR);

  return {
    campaignsRoot,
    schemaRoot,
    projectRoot,
    contentRoot,
    locationsDir: path.join(contentRoot, CAMPAIGN_V2_DIRECTORY_BY_KIND.location),
    locationStatesDir: path.join(contentRoot, CAMPAIGN_V2_DIRECTORY_BY_KIND.locationState),
    sessionsDir: path.join(contentRoot, CAMPAIGN_V2_DIRECTORY_BY_KIND.session),
    eventsDir: path.join(contentRoot, CAMPAIGN_V2_DIRECTORY_BY_KIND.event),
    effectsDir: path.join(contentRoot, CAMPAIGN_V2_DIRECTORY_BY_KIND.effect),
  };
}

export async function loadCampaignV2Content(
  options: CampaignV2StorageOptions,
  validator?: CampaignV2Validator,
): Promise<CampaignV2LoadResult> {
  const resolvedPaths = resolveCampaignV2Paths(options);
  const activeValidator = validator ?? (await createCampaignV2Validator(resolvedPaths.schemaRoot));
  const diagnostics: CampaignV2Diagnostic[] = [];

  const locationsResult = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: CAMPAIGN_V2_DIRECTORY_BY_KIND.location,
    contentKind: 'location',
    validator: activeValidator,
  });
  diagnostics.push(...locationsResult.diagnostics);

  const locationStatesResult = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: CAMPAIGN_V2_DIRECTORY_BY_KIND.locationState,
    contentKind: 'locationState',
    validator: activeValidator,
  });
  diagnostics.push(...locationStatesResult.diagnostics);

  const sessionsResult = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: CAMPAIGN_V2_DIRECTORY_BY_KIND.session,
    contentKind: 'session',
    validator: activeValidator,
  });
  diagnostics.push(...sessionsResult.diagnostics);

  const eventsResult = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: CAMPAIGN_V2_DIRECTORY_BY_KIND.event,
    contentKind: 'event',
    validator: activeValidator,
  });
  diagnostics.push(...eventsResult.diagnostics);

  const effectsResult = await loadJsonDirectory({
    contentRoot: resolvedPaths.contentRoot,
    directoryName: CAMPAIGN_V2_DIRECTORY_BY_KIND.effect,
    contentKind: 'effect',
    validator: activeValidator,
  });
  diagnostics.push(...effectsResult.diagnostics);

  return {
    projectId: options.projectId,
    contentRoot: resolvedPaths.contentRoot,
    loadedAt: new Date(),
    locations: locationsResult.files,
    locationStates: locationStatesResult.files,
    sessions: sessionsResult.files,
    events: eventsResult.files,
    effects: effectsResult.files,
    diagnostics,
  };
}

export async function saveLocation(options: CampaignV2StorageOptions, location: Location) {
  return saveDocument(options, 'location', location);
}

export async function saveLocationState(options: CampaignV2StorageOptions, locationState: LocationState) {
  return saveDocument(options, 'locationState', locationState);
}

export async function saveSession(options: CampaignV2StorageOptions, session: Session) {
  return saveDocument(options, 'session', session);
}

export async function saveEvent(options: CampaignV2StorageOptions, event: Event) {
  return saveDocument(options, 'event', event);
}

export async function saveEffect(options: CampaignV2StorageOptions, effect: Effect) {
  return saveDocument(options, 'effect', effect);
}

export async function getLocation(options: CampaignV2StorageOptions, id: string) {
  return getDocument(options, 'location', id);
}

export async function getLocationState(options: CampaignV2StorageOptions, id: string) {
  return getDocument(options, 'locationState', id);
}

export async function getSession(options: CampaignV2StorageOptions, id: string) {
  return getDocument(options, 'session', id);
}

export async function getEvent(options: CampaignV2StorageOptions, id: string) {
  return getDocument(options, 'event', id);
}

export async function getEffect(options: CampaignV2StorageOptions, id: string) {
  return getDocument(options, 'effect', id);
}

export async function listLocations(options: CampaignV2StorageOptions) {
  return listDocuments(options, 'location');
}

export async function listLocationStates(options: CampaignV2StorageOptions) {
  return listDocuments(options, 'locationState');
}

export async function listSessions(options: CampaignV2StorageOptions) {
  return listDocuments(options, 'session');
}

export async function listEvents(options: CampaignV2StorageOptions) {
  return listDocuments(options, 'event');
}

export async function listEffects(options: CampaignV2StorageOptions) {
  return listDocuments(options, 'effect');
}
