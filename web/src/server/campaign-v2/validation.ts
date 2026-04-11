import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type { CampaignV2ContentKind, CampaignV2Diagnostic, CampaignV2DiagnosticIssue } from './errors';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default as new (options: Record<string, unknown>) => {
  addSchema(schema: object): void;
  getSchema(schemaId: string): ValidateFunction | undefined;
};

export const CAMPAIGN_V2_SCHEMA_FILE_BY_KIND: Record<CampaignV2ContentKind, string> = {
  relation: 'relation.schema.json',
  location: 'location.schema.json',
  locationState: 'locationState.schema.json',
  session: 'session.schema.json',
  event: 'event.schema.json',
  effect: 'effect.schema.json',
};

type AjvError = {
  instancePath: string;
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

export type CampaignV2ValidationContext = {
  sourceName: string;
};

type CampaignV2ValidationSuccess = {
  valid: true;
};

type CampaignV2ValidationFailure = {
  valid: false;
  diagnostic: CampaignV2Diagnostic;
};

export type CampaignV2ValidationResult = CampaignV2ValidationSuccess | CampaignV2ValidationFailure;

export type CampaignV2Validator = {
  schemaRoot: string;
  validate(
    contentKind: CampaignV2ContentKind,
    payload: unknown,
    context: CampaignV2ValidationContext,
  ): CampaignV2ValidationResult;
};

function getDefaultSchemaRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../schemas/campaign-v2');
}

function toIssue(error: AjvError): CampaignV2DiagnosticIssue {
  if (error.keyword === 'required' && typeof error.params?.missingProperty === 'string') {
    const requiredPath = `${error.instancePath}/${error.params.missingProperty}`.replace(/\/+/g, '/');
    return {
      instancePath: requiredPath.startsWith('/') ? requiredPath : `/${requiredPath}`,
      keyword: error.keyword,
      message: 'is required',
    };
  }

  return {
    instancePath: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message ?? 'is invalid',
  };
}

async function loadSchemaFile(schemaRoot: string, fileName: string): Promise<unknown> {
  const schemaPath = path.join(schemaRoot, fileName);
  return JSON.parse(await fs.readFile(schemaPath, 'utf8'));
}

export async function createCampaignV2Validator(schemaRoot = getDefaultSchemaRoot()): Promise<CampaignV2Validator> {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  const schemaFiles = [...new Set(Object.values(CAMPAIGN_V2_SCHEMA_FILE_BY_KIND))];
  for (const fileName of schemaFiles) {
    ajv.addSchema((await loadSchemaFile(schemaRoot, fileName)) as object);
  }

  const validators = new Map<CampaignV2ContentKind, ValidateFunction>();
  for (const [contentKind, fileName] of Object.entries(CAMPAIGN_V2_SCHEMA_FILE_BY_KIND) as Array<
    [CampaignV2ContentKind, string]
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
      const schemaName = CAMPAIGN_V2_SCHEMA_FILE_BY_KIND[contentKind];
      if (!validator) {
        return {
          valid: false,
          diagnostic: {
            code: 'SCHEMA_VALIDATION_ERROR',
            contentKind,
            sourceName: context.sourceName,
            schemaName,
            message: `No validator is registered for ${contentKind}.`,
            issues: [],
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
          contentKind,
          sourceName: context.sourceName,
          schemaName,
          message: `${context.sourceName} failed ${schemaName}.`,
          issues: (validator.errors ?? []).map(toIssue),
        },
      };
    },
  };
}
