// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Effect, Event, Location, LocationState, Npc, PlayerCharacter, Session } from '@/generated/campaign-v2';
import {
  buildCampaignV2GmOverview,
  buildCampaignV2LocationTimeline,
  buildCampaignV2PlayerCharacterDetail,
  createCampaignV2Resolver,
  createCampaignV2Session,
  type CampaignLegacyThreadSummary,
  type CampaignV2GmOverviewPayload,
  type CampaignV2LocationTimelinePayload,
} from '@/server/campaign-v2';

afterEach(() => {
  cleanup();
});

const projectId = 'project-resolver-fixture';

function createFixtureSource() {
  const locations: Location[] = [
    {
      id: 'location-cinder-port',
      type: 'location',
      campaignId: projectId,
      title: 'Cinder Port',
      summary: 'A smoke-bound city where every district keeps score.',
      tags: ['city'],
      relations: [],
    },
    {
      id: 'location-ash-market',
      type: 'location',
      campaignId: projectId,
      title: 'Ash Market',
      summary: 'A crowded market where couriers, brokers, and guards all cross paths.',
      tags: ['market', 'district'],
      parentLocationId: 'location-cinder-port',
      relations: [],
    },
    {
      id: 'location-night-bazaar',
      type: 'location',
      campaignId: projectId,
      title: 'Night Bazaar',
      summary: 'A hidden late-hour market where favors and contraband move quickly.',
      tags: ['market', 'underworld'],
      parentLocationId: 'location-cinder-port',
      relations: [],
    },
  ];

  const locationStates: LocationState[] = [
    {
      id: 'location-state-ash-market-initial',
      type: 'locationState',
      locationId: 'location-ash-market',
      title: 'Ash Market Before Visit',
      summary: 'The market is open, crowded, and tense.',
      status: 'available',
      notes: 'Use before the first broker confrontation.',
      relations: [],
    },
    {
      id: 'location-state-ash-market-post-major-visit',
      type: 'locationState',
      locationId: 'location-ash-market',
      title: 'Ash Market After Major Visit',
      summary: 'The market is quieter, watched more closely, and full of rumors.',
      status: 'active',
      notes: 'Use after the crew pushes the broker trail into the open.',
      relations: [],
    },
  ];

  const sessions: Session[] = [
    createCampaignV2Session({
      id: 'session-docks-pact',
      title: 'Docks Pact',
      locationId: 'location-night-bazaar',
      summary: 'The crew bought time by cutting a risky deal with a dockside fixer.',
      notes: 'This session sets up the Ash Market pressure.',
      relations: [],
    }),
    createCampaignV2Session({
      id: 'session-ash-market-deal',
      title: 'Ash Market Deal',
      locationId: 'location-ash-market',
      summary: 'The crew corners the broker and turns pressure back on Mugland.',
      startingLocationStateId: 'location-state-ash-market-initial',
      resultingLocationStateId: 'location-state-ash-market-post-major-visit',
      notes: 'Treat this as the current mainline session.',
      relations: [
        {
          type: 'involves',
          targetId: 'location-night-bazaar',
        },
        {
          type: 'follows',
          targetId: 'session-docks-pact',
        },
      ],
    }),
    createCampaignV2Session({
      id: 'session-night-bazaar-heist',
      title: 'Night Bazaar Heist',
      locationId: 'location-night-bazaar',
      summary: 'The next likely move is a pressure play in the bazaar.',
      notes: 'Hold for when the broker lead goes loud.',
      relations: [
        {
          type: 'follows',
          targetId: 'session-ash-market-deal',
        },
      ],
    }),
  ];

  const events: Event[] = [
    {
      id: 'event-current-pressure',
      type: 'event',
      title: 'Current Pressure',
      summary: 'The city is tightening around the broker trail right now.',
      status: 'active',
      eventType: 'hook-progressed',
      createdEffectIds: ['effect-heightened-security'],
      notes: 'The overview should treat this as the current anchor event.',
      relations: [
        {
          type: 'relatedTo',
          targetId: 'session-ash-market-deal',
        },
        {
          type: 'occursAt',
          targetId: 'location-ash-market',
        },
      ],
    },
    {
      id: 'event-broker-trail',
      type: 'event',
      title: 'Broker Trail',
      summary: 'A runner points toward the Night Bazaar as the next likely scene.',
      status: 'available',
      eventType: 'clue-found',
      createdEffectIds: [],
      notes: 'Use to pull the table toward the bazaar.',
      relations: [
        {
          type: 'relatedTo',
          targetId: 'session-ash-market-deal',
        },
        {
          type: 'occursAt',
          targetId: 'location-night-bazaar',
        },
      ],
    },
  ];

  const effects: Effect[] = [
    {
      id: 'effect-wanted-in-city',
      type: 'effect',
      title: 'Wanted in City',
      summary: 'City-wide attention makes every public move riskier.',
      status: 'active',
      effectType: 'wanted',
      scope: 'city',
      severity: 'high',
      notes: 'Applies across the whole city.',
      relations: [],
    },
    {
      id: 'effect-heightened-security',
      type: 'effect',
      title: 'Heightened Security',
      summary: 'Extra patrols crowd the market approaches.',
      status: 'active',
      effectType: 'pressure',
      scope: 'local',
      severity: 'medium',
      notes: 'Directly affects Ash Market scenes.',
      relations: [
        {
          type: 'appliesTo',
          targetId: 'location-ash-market',
        },
      ],
    },
    {
      id: 'effect-bazaar-looks-away',
      type: 'effect',
      title: 'Bazaar Looks Away',
      summary: 'Night Bazaar regulars quietly ignore city-level warrants.',
      status: 'active',
      effectType: 'counter-pressure',
      scope: 'local',
      severity: 'low',
      notes: 'Local modifier against the broader wanted pressure.',
      relations: [
        {
          type: 'appliesTo',
          targetId: 'location-night-bazaar',
        },
        {
          type: 'modifies',
          targetId: 'effect-wanted-in-city',
        },
      ],
    },
  ];

  const npcs: Npc[] = [
    {
      id: 'npc-brother-carrow',
      type: 'npc',
      campaignId: projectId,
      title: 'Brother Carrow',
      summary: 'A rattled chapel witness trying to stay useful without being seen helping too openly.',
      status: 'active',
      concept: 'Witness who keeps the chapel fallout personal.',
      role: 'Reluctant witness',
      currentSituation: {
        overview: 'Still close enough to the chapel to hear what the city has started to whisper.',
        currentProblem: 'Is being watched by the wrong people.',
        currentLeverage: 'Knows what records are missing.',
        currentLocationId: 'location-ash-market',
      },
      campaignFitSummary: 'Keeps the chapel pressure tied to a living witness.',
      startingThreadIds: ['thread-stolen-relic'],
      coreThreadIds: ['thread-broker-trail'],
      relations: [
        {
          type: 'relatedTo',
          targetId: 'pc-raina-kestrel',
          note: 'Trusts her instincts more than her plans.',
        },
      ],
    },
  ];

  const playerCharacters: PlayerCharacter[] = [
    {
      id: 'pc-raina-kestrel',
      type: 'playerCharacter',
      campaignId: projectId,
      title: 'Raina Kestrel',
      summary: 'A scout who turns ritual clues into actionable pressure for the crew.',
      status: 'active',
      concept: 'Streetwise clue hound pulled into chapel fallout.',
      partyRole: 'Scout',
      ancestry: 'Human',
      class: 'Investigator',
      age: 24,
      background: {
        origin: 'Ash Market',
        history: 'Ran courier routes until she started chasing ritual inconsistencies instead.',
        incitingIncident: 'Found chapel wax in a market ledger bag.',
        reasonInCity: 'Needs to know who moved the reliquary before the trail goes cold.',
      },
      currentSituation: {
        overview: 'Working the market and chapel together before the witness line collapses.',
        legalStatus: 'Questioned, not charged.',
        socialStatus: 'Useful but disruptive.',
        currentProblem: 'Needs proof before the cult shutters every witness.',
        currentLocationId: 'location-ash-market',
      },
      goals: {
        shortTerm: 'Keep the reliquary clue alive.',
        midTerm: 'Find the courier route that moved it.',
        longTerm: 'Break the ritual network before it matures.',
      },
      traits: {
        strengths: ['Observant', 'Fast'],
        flaws: ['Reckless'],
        personality: ['Dry humor', 'Compulsive note-taking'],
      },
      spotlight: {
        themes: ['Ritual fallout', 'Street loyalty'],
        gmNotes: 'Push her toward witness scenes and escalating clue pressure.',
      },
      connections: {
        importantNpcIds: ['npc-brother-carrow'],
        importantLocationIds: ['location-ash-market'],
        importantThreadIds: ['thread-broker-trail'],
        importantHookIds: ['hook-silent-bell'],
      },
      relationshipNotes: [
        {
          label: 'Brother Carrow',
          role: 'Witness contact',
          note: 'Needs reassurance before he names names.',
        },
      ],
      assets: {
        signatureItems: ['Wax-marked notebook'],
        specialCapabilities: ['Tracks repeated ritual symbols across scenes'],
      },
      campaignFitSummary: 'Turns the chapel and market clues into a concrete playable pressure line.',
      startingThreadIds: ['thread-stolen-relic'],
      coreThreadIds: ['thread-broker-trail'],
      notes: 'A strong first-session focal point when the table needs a clue engine.',
      relations: [
        {
          type: 'relatedTo',
          targetId: 'npc-brother-carrow',
          note: 'He keeps feeding her half-truths because she is the only one moving fast enough.',
        },
        {
          type: 'occursAt',
          targetId: 'location-ash-market',
        },
      ],
    },
  ];

  const legacyThreads: CampaignLegacyThreadSummary[] = [
    {
      id: 'thread-stolen-relic',
      title: 'Stolen Reliquary',
      state: 'active',
      hook: 'The reliquary is missing.',
      playerSummary: 'Someone swapped a chapel relic and left ritual wax behind.',
      gmTruth: 'The reliquary is feeding a harbor rite.',
      timelineAnchor: 'future_possible',
      patternId: 'pattern-ash-ritual',
    },
    {
      id: 'thread-broker-trail',
      title: 'Broker Trail',
      state: 'dormant',
      hook: 'A runner points toward the broker network.',
      playerSummary: 'A courier route might connect the market and chapel clues.',
      gmTruth: 'The broker trail is the cult’s logistics line.',
      timelineAnchor: 'now',
      patternId: 'pattern-lantern-routes',
    },
  ];

  return {
    projectId,
    loadedAt: '2026-04-11T22:10:00.000Z',
    locations,
    locationStates,
    sessions,
    events,
    effects,
    playerCharacters,
    npcs,
    legacyThreads,
    diagnostics: [],
  };
}

function ResolverPayloadView({
  overview,
  timeline,
}: {
  overview: CampaignV2GmOverviewPayload;
  timeline: CampaignV2LocationTimelinePayload;
}) {
  return (
    <div>
      <h1>{overview.currentSession?.title ?? 'No current session'}</h1>
      <section aria-label="likely next locations">
        {overview.likelyNextLocations.map((location) => (
          <div key={location.id}>{location.title}</div>
        ))}
      </section>
      <section aria-label="location timeline">
        {timeline.entries.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`}>{entry.title}</div>
        ))}
      </section>
    </div>
  );
}

describe('campaign-v2 resolvers', () => {
  it('builds a location timeline payload with ordered location states and sessions', () => {
    const payload = buildCampaignV2LocationTimeline(createFixtureSource(), 'location-ash-market');

    expect(payload).not.toBeNull();
    expect(payload?.location.title).toBe('Ash Market');
    expect(payload?.entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      'locationState:location-state-ash-market-initial',
      'session:session-ash-market-deal',
      'locationState:location-state-ash-market-post-major-visit',
    ]);
    expect(payload?.relatedEvents.map((event) => event.title)).toEqual(['Current Pressure', 'Broker Trail']);
    expect(payload?.relatedEffects.map((effect) => effect.title)).toEqual(['Heightened Security', 'Wanted in City']);
  });

  it('builds the top gm overview payload from explicit resolver output', () => {
    const payload = buildCampaignV2GmOverview(createFixtureSource());

    expect(payload.previousSession?.title).toBe('Docks Pact');
    expect(payload.currentSession?.title).toBe('Ash Market Deal');
    expect(payload.likelyNextLocations.map((location) => location.title)).toEqual(['Night Bazaar']);
    expect(payload.likelyNextLocations[0]?.reasons).toEqual(['next-session', 'session-relation', 'event-lead']);
    expect(payload.relatedEvents.map((event) => event.title)).toEqual(['Current Pressure', 'Broker Trail']);
    expect(payload.relatedEffects.map((effect) => effect.title)).toEqual([
      'Heightened Security',
      'Wanted in City',
      'Bazaar Looks Away',
    ]);
    expect(
      payload.relatedEffects.find((effect) => effect.id === 'effect-bazaar-looks-away')?.relevanceByLocation,
    ).toEqual([
      {
        locationId: 'location-night-bazaar',
        locationTitle: 'Night Bazaar',
        kinds: ['local', 'modifier'],
      },
    ]);
  });

  it('supports rendering ui from resolver payloads without direct raw graph access', () => {
    const resolver = createCampaignV2Resolver(createFixtureSource());
    const overview = resolver.buildGmOverview();
    const timeline = resolver.buildLocationTimeline('location-ash-market');

    expect(timeline).not.toBeNull();
    if (!timeline) {
      throw new Error('Expected a location timeline payload.');
    }

    render(<ResolverPayloadView overview={overview} timeline={timeline} />);

    expect(screen.getByRole('heading', { name: 'Ash Market Deal' })).toBeInTheDocument();
    expect(screen.getByText('Night Bazaar')).toBeInTheDocument();
    expect(screen.getByText('Ash Market Before Visit')).toBeInTheDocument();
    expect(screen.getByText('Ash Market After Major Visit')).toBeInTheDocument();
  });

  it('builds a player character detail payload with campaign integration and resolved relations', () => {
    const payload = buildCampaignV2PlayerCharacterDetail(createFixtureSource(), 'pc-raina-kestrel');

    expect(payload).not.toBeNull();
    expect(payload?.playerCharacter.title).toBe('Raina Kestrel');
    expect(payload?.playerCharacter.currentSituation.currentLocationTitle).toBe('Ash Market');
    expect(payload?.playerCharacter.startingThreads.map((thread) => thread.title)).toEqual(['Stolen Reliquary']);
    expect(payload?.playerCharacter.coreThreads.map((thread) => thread.title)).toEqual(['Broker Trail']);
    expect(payload?.playerCharacter.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: 'npc-brother-carrow',
          targetTitle: 'Brother Carrow',
          targetType: 'npc',
          missing: false,
        }),
      ]),
    );
    expect(payload?.playerCharacter.linkedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'npc-brother-carrow',
          type: 'npc',
        }),
        expect.objectContaining({
          id: 'thread-broker-trail',
          type: 'thread',
        }),
      ]),
    );
  });
});
