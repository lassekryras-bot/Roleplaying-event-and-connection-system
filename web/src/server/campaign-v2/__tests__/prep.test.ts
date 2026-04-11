// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { CampaignV2ResolverSource } from '@/server/campaign-v2';
import { buildCampaignV2PrepPayload, answerCampaignV2PrepQuestion } from '@/server/campaign-v2';

function createSource(): CampaignV2ResolverSource {
  return {
    projectId: 'mornqar-alkenstar',
    loadedAt: '2026-04-12T09:00:00.000Z',
    locations: [
      {
        id: 'location-alkenstar',
        type: 'location',
        campaignId: 'mornqar-alkenstar',
        title: 'Alkenstar',
        summary: 'A soot-choked city under pressure.',
        tags: ['city'],
        relations: [],
      },
      {
        id: 'location-barrel-and-bullet-saloon',
        type: 'location',
        campaignId: 'mornqar-alkenstar',
        title: 'Barrel & Bullet Saloon',
        summary: 'A dependable saloon and safehouse.',
        tags: ['saloon', 'safehouse'],
        parentLocationId: 'location-alkenstar',
        relations: [],
      },
      {
        id: 'location-mugland-warehouse',
        type: 'location',
        campaignId: 'mornqar-alkenstar',
        title: 'Mugland Warehouse',
        summary: 'A guarded logistics hub with dirty ledgers.',
        tags: ['warehouse'],
        parentLocationId: 'location-alkenstar',
        relations: [],
      },
    ],
    locationStates: [
      {
        id: 'location-state-barrel-and-bullet-saloon-initial',
        type: 'locationState',
        locationId: 'location-barrel-and-bullet-saloon',
        title: 'Barrel & Bullet Before Visit',
        summary: 'Before the first job briefing.',
        status: 'available',
        notes: 'Foebe still keeps the books neat.',
        relations: [],
      },
      {
        id: 'location-state-barrel-and-bullet-saloon-post-major-visit',
        type: 'locationState',
        locationId: 'location-barrel-and-bullet-saloon',
        title: 'Barrel & Bullet After Major Visit',
        summary: 'The saloon is tense and watched after the last job.',
        status: 'active',
        notes: 'Regulars now speak in lowered voices.',
        relations: [{ type: 'relatedTo', targetId: 'event-runner-warning' }],
      },
    ],
    sessions: [
      {
        id: 'session-first-briefing',
        type: 'session',
        title: 'First Briefing',
        locationId: 'location-barrel-and-bullet-saloon',
        summary: 'The crew first heard about Mugland pressure here.',
        notes: 'Earlier planning session.',
        relations: [],
        startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
        resultingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
      },
      {
        id: 'session-opening-pressure',
        type: 'session',
        title: 'Opening Pressure',
        locationId: 'location-barrel-and-bullet-saloon',
        summary: 'The crew takes stock of Mugland pressure.',
        notes: 'Set the table for the first counter-move.',
        relations: [
          { type: 'relatedTo', targetId: 'event-runner-warning' },
          { type: 'follows', targetId: 'session-first-briefing' },
        ],
        startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
        resultingLocationStateId: 'location-state-barrel-and-bullet-saloon-post-major-visit',
      },
      {
        id: 'session-warehouse-heist',
        type: 'session',
        title: 'Warehouse Heist',
        locationId: 'location-mugland-warehouse',
        summary: 'The crew hits Mugland logistics directly.',
        notes: 'Next planned escalation.',
        relations: [{ type: 'follows', targetId: 'session-opening-pressure' }],
        startingLocationStateId: null,
        resultingLocationStateId: null,
      },
    ],
    events: [
      {
        id: 'event-runner-warning',
        type: 'event',
        title: 'Runner Warning',
        summary: 'A courier warns the crew that Mugland is watching the saloon.',
        status: 'active',
        notes: 'This points toward the warehouse books.',
        relations: [
          { type: 'occursAt', targetId: 'location-barrel-and-bullet-saloon' },
          { type: 'relatedTo', targetId: 'session-opening-pressure' },
          { type: 'involves', targetId: 'location-mugland-warehouse' },
        ],
        eventType: 'hook-progressed',
        createdEffectIds: ['effect-heightened-security'],
      },
    ],
    effects: [
      {
        id: 'effect-wanted-in-city',
        type: 'effect',
        title: 'Wanted in City',
        summary: 'Descriptions are circulating across Alkenstar.',
        status: 'active',
        notes: 'City-wide pressure.',
        relations: [{ type: 'relatedTo', targetId: 'event-runner-warning' }],
        effectType: 'wanted',
        scope: 'city',
        severity: 'high',
      },
      {
        id: 'effect-heightened-security',
        type: 'effect',
        title: 'Heightened Security',
        summary: 'Extra scrutiny around the saloon and nearby alleys.',
        status: 'active',
        notes: 'Local fallout from Mugland attention.',
        relations: [{ type: 'appliesTo', targetId: 'location-barrel-and-bullet-saloon' }],
        effectType: 'security',
        scope: 'local',
        severity: 'medium',
      },
      {
        id: 'effect-bar-ignores-wanted-status',
        type: 'effect',
        title: 'Bar Ignores Wanted Status',
        summary: 'Foebe keeps the saloon open to the crew despite the heat.',
        status: 'active',
        notes: 'Local modifier against broader wanted pressure.',
        relations: [
          { type: 'appliesTo', targetId: 'location-barrel-and-bullet-saloon' },
          { type: 'modifies', targetId: 'effect-wanted-in-city' },
        ],
        effectType: 'safe-haven',
        scope: 'local',
        severity: 'low',
      },
    ],
    diagnostics: [],
  };
}

describe('campaign-v2 prep helpers', () => {
  it('builds read-only prep answers from v2 resolver output', () => {
    const payload = buildCampaignV2PrepPayload(createSource(), 'location-barrel-and-bullet-saloon');

    expect(payload.projectId).toBe('mornqar-alkenstar');
    expect(payload.selectedLocationTitle).toBe('Barrel & Bullet Saloon');
    expect(payload.answers.whatChangedHereLastTime.summary).toContain('First Briefing');
    expect(payload.answers.whatChangedHereLastTime.references).toContainEqual(
      expect.objectContaining({
        kind: 'session',
        id: 'session-first-briefing',
      }),
    );
    expect(payload.answers.whatIsActiveNow.summary).toContain('Opening Pressure');
    expect(payload.answers.whatBroaderEffectsAreInScope.bullets).toEqual(
      expect.arrayContaining([
        'Inherited effects: Wanted in City',
        'Local modifiers of broader pressure: Bar Ignores Wanted Status',
      ]),
    );
    expect(payload.answers.whatShouldIPrepNext.summary).toContain('Mugland Warehouse');
  });

  it('answers a single prep question in AI-friendly form with stable input', () => {
    const answer = answerCampaignV2PrepQuestion(
      createSource(),
      'whatIsActiveNow',
      'location-barrel-and-bullet-saloon',
    );

    expect(answer.question).toBe('What is active now?');
    expect(answer.summary).toContain('Opening Pressure');
    expect(answer.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'session',
          id: 'session-opening-pressure',
        }),
        expect.objectContaining({
          kind: 'effect',
          id: 'effect-wanted-in-city',
        }),
      ]),
    );
  });
});
