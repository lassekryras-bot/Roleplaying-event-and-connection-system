// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { Location } from '@/generated/campaign-v2';
import {
  attachEffectModifier,
  attachEffectToLocation,
  createCampaignV2Effect,
  getDirectEffectsOnLocation,
  getInheritedEffectsFromScope,
  getLocalEffectsModifyingBroaderEffects,
  resolveCampaignV2Effect,
  resolveCampaignV2LocationEffects,
  resolveEffectModifiers,
} from '@/server/campaign-v2';

function createDistrict(): Location {
  return {
    id: 'location-cinder-port',
    type: 'location',
    campaignId: 'project-1',
    title: 'Cinder Port',
    summary: 'The broader city district around the docks.',
    tags: ['district'],
    relations: [],
  };
}

function createUnionYard(): Location {
  return {
    id: 'location-union-yard',
    type: 'location',
    campaignId: 'project-1',
    title: 'Dockworkers Union Yard',
    summary: 'A union yard with a back-room bar and nervous labor stewards.',
    tags: ['docks'],
    parentLocationId: 'location-cinder-port',
    relations: [],
  };
}

describe('campaign-v2 effect helpers', () => {
  it('creates a minimal v2 effect record', () => {
    const effect = createCampaignV2Effect({
      id: 'effect-wanted-in-city',
      title: 'Wanted in City',
      summary: 'Descriptions are circulating across the harbor.',
      status: 'active',
      effectType: 'wanted',
      scope: 'city',
      severity: 'high',
    });

    expect(effect).toEqual({
      id: 'effect-wanted-in-city',
      type: 'effect',
      title: 'Wanted in City',
      summary: 'Descriptions are circulating across the harbor.',
      status: 'active',
      notes: null,
      relations: [],
      effectType: 'wanted',
      scope: 'city',
      severity: 'high',
    });
  });

  it('resolves local, inherited, and modifier effects for a prep location', () => {
    const district = createDistrict();
    const unionYard = createUnionYard();
    const wantedInCity = createCampaignV2Effect({
      id: 'effect-wanted-in-city',
      title: 'Wanted in City',
      summary: 'Descriptions are circulating across the harbor.',
      status: 'active',
      effectType: 'wanted',
      scope: 'city',
      severity: 'high',
    });
    const districtCurfew = attachEffectToLocation(
      createCampaignV2Effect({
        id: 'effect-district-curfew',
        title: 'District Curfew',
        summary: 'The district clamps down after dark.',
        status: 'active',
        effectType: 'pressure',
        scope: 'subtree',
        severity: 'medium',
      }),
      district,
    );
    const heightenedSecurity = attachEffectToLocation(
      createCampaignV2Effect({
        id: 'effect-heightened-security',
        title: 'Heightened Security',
        summary: 'Extra patrols make the union yard harder to work quietly.',
        status: 'active',
        effectType: 'security',
        scope: 'local',
        severity: 'medium',
      }),
      unionYard,
    );
    const barIgnoresWantedStatus = attachEffectModifier(
      attachEffectToLocation(
        createCampaignV2Effect({
          id: 'effect-bar-ignores-wanted-status',
          title: 'Bar Ignores Wanted Status',
          summary: 'The dockside bar keeps serving the crew despite the heat.',
          status: 'active',
          effectType: 'safe-haven',
          scope: 'local',
          severity: 'low',
        }),
        unionYard,
      ),
      wantedInCity,
    );
    const effects = [wantedInCity, districtCurfew, heightenedSecurity, barIgnoresWantedStatus];

    expect(getDirectEffectsOnLocation(unionYard, effects).map((effect) => effect.title)).toEqual([
      'Bar Ignores Wanted Status',
      'Heightened Security',
    ]);
    expect(getInheritedEffectsFromScope(unionYard, [district, unionYard], effects).map((effect) => effect.title)).toEqual([
      'District Curfew',
      'Wanted in City',
    ]);
    expect(getLocalEffectsModifyingBroaderEffects(unionYard, [district, unionYard], effects).map((effect) => effect.title)).toEqual([
      'Bar Ignores Wanted Status',
    ]);
    expect(resolveEffectModifiers(wantedInCity, effects).map((effect) => effect.title)).toEqual(['Bar Ignores Wanted Status']);
    expect(resolveCampaignV2Effect(barIgnoresWantedStatus, [district, unionYard], effects)).toEqual({
      effect: barIgnoresWantedStatus,
      locations: [unionYard],
      modifies: [wantedInCity],
      modifiedBy: [],
    });
    expect(resolveCampaignV2LocationEffects(unionYard, [district, unionYard], effects)).toEqual({
      location: unionYard,
      localEffects: [barIgnoresWantedStatus, heightenedSecurity],
      inheritedEffects: [districtCurfew, wantedInCity],
      localModifiersOfInherited: [barIgnoresWantedStatus],
      allRelevantEffects: [barIgnoresWantedStatus, districtCurfew, heightenedSecurity, wantedInCity],
    });
  });
});
