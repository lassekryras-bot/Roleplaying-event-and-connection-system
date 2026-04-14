import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { GmTimelineContentKind, GmTimelineDiagnostic, GmTimelineDiagnosticIssue } from './errors';

const require = createRequire(import.meta.url);

export const GM_TIMELINE_SCHEMA_FILE_BY_KIND: Record<GmTimelineContentKind, string> = {
  timeline: 'timeline.schema.json',
  session: 'session.schema.json',
  place: 'place.schema.json',
  hook: 'hook.schema.json',
  threadRef: 'thread-ref.schema.json',
  sessionIndex: 'session-index.schema.json',
  placeIndex: 'place-index.schema.json',
  hookIndex: 'hook-index.schema.json',
  threadIndex: 'thread-index.schema.json',
};

type AjvError = {
  instancePath?: string;
  dataPath?: string;
  keyword: string;
  message?: string;
  params?: {
    missingProperty?: string;
    [key: string]: unknown;
  };
};

type ValidateFunction = ((data: unknown) => boolean) & {
  errors?: AjvError[] | null;
};

type AjvConstructor = new (options: Record<string, unknown>) => {
  addSchema(schema: object): void;
  getSchema(schemaId: string): ValidateFunction | undefined;
};

function resolveAjvImplementation(): {
  Ajv: AjvConstructor;
  addFormats: ((ajv: unknown) => void) | null;
  needsLegacySchemaTransform: boolean;
} {
  try {
    return {
      Ajv: require('ajv/dist/2020.js').default as AjvConstructor,
      addFormats: require('ajv-formats').default as (ajv: unknown) => void,
      needsLegacySchemaTransform: false,
    };
  } catch {
    const legacyAjv = require('ajv');
    return {
      Ajv: (legacyAjv.default ?? legacyAjv) as AjvConstructor,
      addFormats: null,
      needsLegacySchemaTransform: true,
    };
  }
}

const { Ajv: AjvImplementation, addFormats, needsLegacySchemaTransform } = resolveAjvImplementation();

function normalizeSchemaForAjv(schema: unknown): unknown {
  if (!needsLegacySchemaTransform || schema === null || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(normalizeSchemaForAjv);
  }

  const normalizedEntries = Object.entries(schema as Record<string, unknown>).flatMap(([key, value]) => {
    if (key === '$schema') {
      return [];
    }

    const normalizedKey = key === '$defs' ? 'definitions' : key;
    const normalizedValue =
      normalizedKey === '$ref' && typeof value === 'string'
        ? value.replaceAll('#/$defs/', '#/definitions/')
        : normalizeSchemaForAjv(value);

    return [[normalizedKey, normalizedValue] as const];
  });

  return Object.fromEntries(normalizedEntries);
}

type GmTimelineValidationContext = {
  projectId: string;
  relativePath: string;
};

type GmTimelineValidationSuccess = {
  valid: true;
};

type GmTimelineValidationFailure = {
  valid: false;
  diagnostic: GmTimelineDiagnostic;
};

export type GmTimelineValidationResult = GmTimelineValidationSuccess | GmTimelineValidationFailure;

export type GmTimelineValidator = {
  schemaRoot: string;
  validate(
    contentKind: GmTimelineContentKind,
    payload: unknown,
    context: GmTimelineValidationContext,
  ): GmTimelineValidationResult;
};

function normalizeErrorMessage(message: string) {
  return message.startsWith('should ') ? `must ${message.slice('should '.length)}` : message;
}

function toIssue(error: AjvError): GmTimelineDiagnosticIssue {
  const instancePath = error.instancePath ?? error.dataPath ?? '/';

  if (error.keyword === 'required' && typeof error.params?.missingProperty === 'string') {
    const requiredPath = `${instancePath}/${error.params.missingProperty}`.replace(/\/+/g, '/');
    return {
      instancePath: requiredPath.startsWith('/') ? requiredPath : `/${requiredPath}`,
      keyword: error.keyword,
      message: 'is required',
    };
  }

  return {
    instancePath: instancePath || '/',
    keyword: error.keyword,
    message: normalizeErrorMessage(error.message ?? 'is invalid'),
  };
}

async function loadSchemaFile(schemaRoot: string, fileName: string): Promise<unknown> {
  const schemaPath = path.join(schemaRoot, fileName);
  return normalizeSchemaForAjv(JSON.parse(await fs.readFile(schemaPath, 'utf8')));
}

export async function createGmTimelineValidator(schemaRoot: string): Promise<GmTimelineValidator> {
  const ajv = new AjvImplementation({
    allErrors: true,
    strict: false,
    schemaId: 'auto',
  });
  addFormats?.(ajv);

  const schemaFiles = [
    'shared-defs.schema.json',
    ...Object.values(GM_TIMELINE_SCHEMA_FILE_BY_KIND),
    'gm-timeline.bundle.schema.json',
  ];

  const uniqueSchemaFiles = [...new Set(schemaFiles)];
  for (const fileName of uniqueSchemaFiles) {
    ajv.addSchema((await loadSchemaFile(schemaRoot, fileName)) as object);
  }

  const validators = new Map<GmTimelineContentKind, ValidateFunction>();
  for (const [contentKind, fileName] of Object.entries(GM_TIMELINE_SCHEMA_FILE_BY_KIND) as Array<
    [GmTimelineContentKind, string]
  >) {
    const schema = (await loadSchemaFile(schemaRoot, fileName)) as { $id?: string };
    if (typeof schema.$id !== 'string') {
      throw new Error(`Schema ${fileName} is missing a valid $id.`);
    }

    const validator = ajv.getSchema(schema.$id);
    if (!validator) {
      throw new Error(`Schema ${fileName} was not registered.`);
    }

    validators.set(contentKind, validator);
  }

  return {
    schemaRoot,
    validate(contentKind, payload, context) {
      const validator = validators.get(contentKind);
      const schemaName = GM_TIMELINE_SCHEMA_FILE_BY_KIND[contentKind];
      if (!validator) {
        return {
          valid: false,
          diagnostic: {
            code: 'SCHEMA_VALIDATION_ERROR',
            projectId: context.projectId,
            contentKind,
            relativePath: context.relativePath,
            schemaName,
            message: `No validator is registered for ${contentKind}.`,
          },
        };
      }

      const isValid = validator(payload);
      if (isValid) {
        return { valid: true };
      }

      return {
        valid: false,
        diagnostic: {
          code: 'SCHEMA_VALIDATION_ERROR',
          projectId: context.projectId,
          contentKind,
          relativePath: context.relativePath,
          schemaName,
          message: `File does not match ${schemaName}.`,
          issues: (validator.errors ?? []).map(toIssue),
        },
      };
    },
  };
}
