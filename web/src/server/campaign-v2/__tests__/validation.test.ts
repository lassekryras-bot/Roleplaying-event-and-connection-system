// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createCampaignV2Validator } from '@/server/campaign-v2';

describe('campaign-v2 validator', () => {
  it('accepts a valid location payload with the default schema root', async () => {
    const validator = await createCampaignV2Validator();

    const result = validator.validate(
      'location',
      {
        id: 'location-ash-market',
        type: 'location',
        title: 'Ash Market',
        campaignId: 'campaign-1',
        summary: 'A soot-covered market district.',
        tags: ['market', 'city'],
        relations: [],
      },
      {
        sourceName: 'fixtures/location.json',
      },
    );

    expect(result).toEqual({ valid: true });
  });

  it('returns readable diagnostics for schema failures', async () => {
    const validator = await createCampaignV2Validator();

    const missingRequired = validator.validate(
      'session',
      {
        id: 'session-ash-market-01',
        type: 'session',
        title: 'Opening Night',
        locationId: 'location-ash-market',
      },
      {
        sourceName: 'fixtures/session.json',
      },
    );

    expect(missingRequired.valid).toBe(false);
    if (missingRequired.valid) {
      return;
    }

    expect(missingRequired.diagnostic).toMatchObject({
      code: 'SCHEMA_VALIDATION_ERROR',
      contentKind: 'session',
      sourceName: 'fixtures/session.json',
      schemaName: 'session.schema.json',
    });
    expect(missingRequired.diagnostic.issues).toContainEqual({
      instancePath: '/summary',
      keyword: 'required',
      message: 'is required',
    });

    const badPattern = validator.validate(
      'locationState',
      {
        id: 'location-state-market-fire',
        type: 'locationState',
        locationId: 'place-incorrect',
        title: 'After the Fire',
        summary: 'The market is quiet and damaged.',
        status: 'active',
      },
      {
        sourceName: 'fixtures/location-state.json',
      },
    );

    expect(badPattern.valid).toBe(false);
    if (badPattern.valid) {
      return;
    }

    expect(badPattern.diagnostic.issues).toContainEqual({
      instancePath: '/locationId',
      keyword: 'pattern',
      message: 'must match pattern "^location-[a-z0-9-]+$"',
    });
  });
});
