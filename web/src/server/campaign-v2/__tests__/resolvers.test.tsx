// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Effect, Event, Location, LocationState, Session } from '@/generated/campaign-v2';
import {
  buildCampaignV2GmOverview,
  buildCampaignV2LocationTimeline,
  createCampaignV2Resolver,
  createCampaignV2Session,
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

  return {
    projectId,
    loadedAt: '2026-04-11T22:10:00.000Z',
    locations,
    locationStates,
    sessions,
    events,
    effects,
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
});
