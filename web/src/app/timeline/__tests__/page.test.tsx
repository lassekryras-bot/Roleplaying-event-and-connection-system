import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CampaignV2InspectorPayload } from '@/features/campaign-v2/types';
import type { GmTimelineBoardPayload } from '@/features/gm-timeline/types';

import TimelinePage from '../page';

const { mockAuthSession, mockReplace, mockSearchParamsState } = vi.hoisted(() => ({
  mockAuthSession: {
    role: 'gm',
    userId: 'gm-1',
    username: 'Admingm',
  },
  mockReplace: vi.fn(),
  mockSearchParamsState: {
    project: 'project-3',
    surface: null as string | null,
    location: null as string | null,
  },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    ...mockAuthSession,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: (key: string) =>
      key === 'project'
        ? mockSearchParamsState.project
        : key === 'surface'
          ? mockSearchParamsState.surface
          : key === 'location'
            ? mockSearchParamsState.location
            : null,
    toString: () => {
      const params = new URLSearchParams();
      if (mockSearchParamsState.project) {
        params.set('project', mockSearchParamsState.project);
      }
      if (mockSearchParamsState.surface) {
        params.set('surface', mockSearchParamsState.surface);
      }
      if (mockSearchParamsState.location) {
        params.set('location', mockSearchParamsState.location);
      }
      return params.toString();
    },
  }),
}));

function createBoardPayload(): GmTimelineBoardPayload {
  return {
    project: {
      id: 'project-3',
      name: 'Hundred Notes Test',
      status: 'active',
      hasTimelineContent: true,
    },
    projects: [
      {
        id: 'project-3',
        name: 'Hundred Notes Test',
        status: 'active',
        hasTimelineContent: true,
      },
    ],
    timeline: {
      campaignId: 'project-3',
      title: 'Hundred Notes GM Timeline',
      currentSequence: 3,
      activeSessionId: 'session-current-ledger',
      sessionIds: [
        'session-past-docks',
        'session-past-auction',
        'session-current-ledger',
        'session-future-bank',
        'session-future-glass',
        'session-future-shrine',
      ],
      updatedAt: '2026-04-06T09:30:00.000Z',
    },
    sessions: [
      {
        id: 'session-past-docks',
        campaignId: 'project-3',
        sequence: 1,
        status: 'ended',
        headline: 'Smoke on the Quay',
        summary: 'Past docks session.',
        placeIds: ['place-brass-docks'],
        startedAt: '2026-03-04T19:00:00.000Z',
        endedAt: '2026-03-04T22:15:00.000Z',
      },
      {
        id: 'session-past-auction',
        campaignId: 'project-3',
        sequence: 2,
        status: 'ended',
        headline: 'The Gilt Mask Auction',
        summary: 'Past auction session.',
        placeIds: ['place-gilt-hall'],
        startedAt: '2026-03-18T19:00:00.000Z',
        endedAt: '2026-03-18T22:00:00.000Z',
      },
      {
        id: 'session-current-ledger',
        campaignId: 'project-3',
        sequence: 3,
        status: 'active',
        headline: "Mornqar's Ledger",
        summary: 'Current live session.',
        expectedDirection: 'Follow the broker.',
        placeIds: ['place-grand-archive', 'place-skybridge-market'],
        startedAt: '2026-04-06T18:30:00.000Z',
      },
      {
        id: 'session-future-bank',
        campaignId: 'project-3',
        sequence: 4,
        status: 'planning',
        headline: 'Bank of Ashen Notes',
        summary: 'Next likely session.',
        placeIds: ['place-sparklock-bank'],
      },
      {
        id: 'session-future-glass',
        campaignId: 'project-3',
        sequence: 5,
        status: 'planning',
        headline: 'Glassworks Ghost Route',
        summary: 'Backup future session.',
        placeIds: ['place-sunspike-glassworks'],
      },
      {
        id: 'session-future-shrine',
        campaignId: 'project-3',
        sequence: 6,
        status: 'planning',
        headline: 'Cascade Parley',
        summary: 'Diplomatic future session.',
        placeIds: ['place-cascade-shrine'],
      },
    ],
    places: [
      {
        id: 'place-brass-docks',
        campaignId: 'project-3',
        headline: 'Brass Docks',
        description: 'Fog and rumors.',
        hookIds: ['hook-ghost-barge-rumor'],
      },
      {
        id: 'place-gilt-hall',
        campaignId: 'project-3',
        headline: 'Gilt Hall',
        description: 'Auction floor.',
        hookIds: ['hook-sable-auctioneer'],
      },
      {
        id: 'place-grand-archive',
        campaignId: 'project-3',
        headline: 'Grand Archive',
        description: 'Dust and ledgers.',
        hookIds: ['hook-sealed-stacks'],
      },
      {
        id: 'place-skybridge-market',
        campaignId: 'project-3',
        headline: 'Skybridge Market',
        description: 'Broker traffic.',
        hookIds: ['hook-scarf-broker'],
      },
      {
        id: 'place-sparklock-bank',
        campaignId: 'project-3',
        headline: 'Sparklock Bank',
        description: 'Quiet vault.',
        hookIds: ['hook-night-vault'],
      },
      {
        id: 'place-sunspike-glassworks',
        campaignId: 'project-3',
        headline: 'Sunspike Glassworks',
        description: 'Furnace district.',
        hookIds: ['hook-furnace-saboteur'],
      },
      {
        id: 'place-cascade-shrine',
        campaignId: 'project-3',
        headline: 'Cascade Shrine',
        description: 'Rain and bargains.',
        hookIds: ['hook-rain-prayer'],
      },
    ],
    hooks: [
      {
        id: 'hook-ghost-barge-rumor',
        campaignId: 'project-3',
        placeId: 'place-brass-docks',
        headline: 'Ghost Barge Rumor',
        description: 'Past hook.',
        status: 'resolved',
        checks: [],
        threadIds: ['thread-brass-ghost-barge'],
      },
      {
        id: 'hook-sable-auctioneer',
        campaignId: 'project-3',
        placeId: 'place-gilt-hall',
        headline: 'Sable Auctioneer',
        description: 'Past hook.',
        status: 'discarded',
        checks: [],
        threadIds: ['thread-auction-mask-network'],
      },
      {
        id: 'hook-sealed-stacks',
        campaignId: 'project-3',
        placeId: 'place-grand-archive',
        headline: 'Sealed Stack Twelve',
        description: 'Current hook.',
        status: 'available',
        checks: [],
        threadIds: ['thread-sealed-stack-twelve'],
      },
      {
        id: 'hook-scarf-broker',
        campaignId: 'project-3',
        placeId: 'place-skybridge-market',
        headline: 'Scarf Broker',
        description: 'Current hook.',
        status: 'in_progress',
        checks: [],
        threadIds: ['thread-mornqar-scarf'],
      },
      {
        id: 'hook-night-vault',
        campaignId: 'project-3',
        placeId: 'place-sparklock-bank',
        headline: 'Night Vault Transfer',
        description: 'Future hook.',
        status: 'available',
        checks: [],
        threadIds: ['thread-red-silt-route'],
      },
      {
        id: 'hook-furnace-saboteur',
        campaignId: 'project-3',
        placeId: 'place-sunspike-glassworks',
        headline: 'Furnace Saboteur',
        description: 'Future hook.',
        status: 'available',
        checks: [],
        threadIds: ['thread-furnace-blackmail'],
      },
      {
        id: 'hook-rain-prayer',
        campaignId: 'project-3',
        placeId: 'place-cascade-shrine',
        headline: 'Rain Prayer Pact',
        description: 'Future hook.',
        status: 'available',
        checks: [],
        threadIds: ['thread-rain-pact'],
      },
    ],
    threadRefs: [
      { id: 'thread-brass-ghost-barge', title: 'Brass Ghost Barge', linkedHookIds: ['hook-ghost-barge-rumor'] },
      { id: 'thread-auction-mask-network', title: 'Auction Mask Network', linkedHookIds: ['hook-sable-auctioneer'] },
      { id: 'thread-sealed-stack-twelve', title: 'Sealed Stack Twelve', linkedHookIds: ['hook-sealed-stacks'] },
      { id: 'thread-mornqar-scarf', title: "Mornqar's Scarf", linkedHookIds: ['hook-scarf-broker'] },
      { id: 'thread-red-silt-route', title: 'Red Silt Route', linkedHookIds: ['hook-night-vault'] },
      { id: 'thread-furnace-blackmail', title: 'Furnace Blackmail', linkedHookIds: ['hook-furnace-saboteur'] },
      { id: 'thread-rain-pact', title: 'Rain Pact', linkedHookIds: ['hook-rain-prayer'] },
    ],
    indexes: {
      sessionIndex: {
        items: [
          { id: 'session-past-docks', headline: 'Smoke on the Quay', file: 'session-past-docks.json', sequence: 1, summary: 'Past docks session.' },
          { id: 'session-past-auction', headline: 'The Gilt Mask Auction', file: 'session-past-auction.json', sequence: 2, summary: 'Past auction session.' },
          { id: 'session-current-ledger', headline: "Mornqar's Ledger", file: 'session-current-ledger.json', sequence: 3, summary: 'Current live session.' },
          { id: 'session-future-bank', headline: 'Bank of Ashen Notes', file: 'session-future-bank.json', sequence: 4, summary: 'Next likely session.' }
        ],
      },
      placeIndex: {
        items: [
          { id: 'place-grand-archive', headline: 'Grand Archive', file: 'place-grand-archive.json', description: 'Dust and ledgers.' },
          { id: 'place-skybridge-market', headline: 'Skybridge Market', file: 'place-skybridge-market.json', description: 'Broker traffic.' },
          { id: 'place-sparklock-bank', headline: 'Sparklock Bank', file: 'place-sparklock-bank.json', description: 'Quiet vault.' },
        ],
      },
      hookIndex: {
        items: [
          { id: 'hook-scarf-broker', headline: 'Scarf Broker', file: 'hook-scarf-broker.json', placeId: 'place-skybridge-market', threadIds: ['thread-mornqar-scarf'] },
        ],
      },
      threadIndex: {
        items: [
          { id: 'thread-mornqar-scarf', title: "Mornqar's Scarf", file: 'thread-mornqar-scarf.json', summary: 'The scarf lead.' },
        ],
      },
    },
    diagnostics: [],
    counts: {
      filesLoaded: 25,
      sessions: 6,
      places: 7,
      hooks: 7,
      threadRefs: 7,
      invalidFiles: 0,
    },
    loadedAt: '2026-04-06T09:30:00.000Z',
  };
}

function createCampaignV2InspectorPayload(): CampaignV2InspectorPayload {
  return {
    project: {
      id: 'project-3',
      name: 'Hundred Notes Test',
      status: 'active',
      hasCampaignV2Content: true,
      preferredContentSubdir: 'campaign-v2-shadow',
    },
    projects: [
      {
        id: 'project-3',
        name: 'Hundred Notes Test',
        status: 'active',
        hasCampaignV2Content: true,
        preferredContentSubdir: 'campaign-v2-shadow',
      },
      {
        id: 'mornqar-alkenstar',
        name: 'Mornqar: Alkenstar',
        status: 'active',
        hasCampaignV2Content: true,
        preferredContentSubdir: 'campaign-v2',
      },
    ],
    selectedLocationId: 'location-grand-archive',
    locations: [
      {
        id: 'location-grand-archive',
        title: 'Grand Archive',
        summary: 'A powder-dry archive where ledgers go missing in plain sight.',
        tags: ['records', 'investigation'],
        parentLocationId: null,
      },
      {
        id: 'location-skybridge-market',
        title: 'Skybridge Market',
        summary: 'A noisy market where couriers and brokers overlap.',
        tags: ['market'],
        parentLocationId: null,
      },
    ],
    overview: {
      projectId: 'project-3',
      loadedAt: '2026-04-11T21:45:00.000Z',
      previousSession: {
        id: 'session-gilt-mask-auction',
        title: 'The Gilt Mask Auction',
        summary: 'Past auction session.',
        notes: null,
        locationId: 'location-gilt-hall',
        locationTitle: 'Gilt Hall',
        startingLocationStateId: null,
        startingLocationStateTitle: null,
        resultingLocationStateId: null,
        resultingLocationStateTitle: null,
        relatedEventIds: [],
        relatedEffectIds: [],
      },
      currentSession: {
        id: 'session-mornqar-ledger',
        title: "Mornqar's Ledger",
        summary: 'Current live session.',
        notes: 'Follow the broker.',
        locationId: 'location-grand-archive',
        locationTitle: 'Grand Archive',
        startingLocationStateId: 'location-state-grand-archive-initial',
        startingLocationStateTitle: 'Grand Archive Before Visit',
        resultingLocationStateId: 'location-state-grand-archive-post-major-visit',
        resultingLocationStateTitle: 'Grand Archive After Major Visit',
        relatedEventIds: ['event-now-project-3'],
        relatedEffectIds: ['effect-pattern-test-1'],
      },
      likelyNextLocations: [
        {
          id: 'location-skybridge-market',
          title: 'Skybridge Market',
          summary: 'A noisy market where couriers and brokers overlap.',
          tags: ['market'],
          parentLocationId: null,
          reasons: ['event-lead'],
        },
      ],
      relatedEvents: [
        {
          id: 'event-now-project-3',
          title: 'Current moment',
          summary: 'This seeded campaign is built to stress-test note density.',
          status: 'active',
          eventType: 'consequence-triggered',
          notes: 'GM truth.',
          createdEffectIds: [],
          locationIds: ['location-grand-archive'],
          locationTitles: ['Grand Archive'],
          sessionIds: ['session-mornqar-ledger'],
          sessionTitles: ["Mornqar's Ledger"],
        },
      ],
      relatedEffects: [
        {
          id: 'effect-pattern-test-1',
          title: 'Pattern Test 1',
          summary: 'Ongoing pressure in the archive district.',
          status: 'active',
          effectType: 'pressure',
          scope: 'city',
          severity: 'medium',
          notes: null,
          modifiesEffectIds: [],
          modifiedByEffectIds: [],
          locationIds: ['location-grand-archive'],
          locationTitles: ['Grand Archive'],
          relevanceByLocation: [
            {
              locationId: 'location-grand-archive',
              locationTitle: 'Grand Archive',
              kinds: ['inherited'],
            },
          ],
        },
      ],
      diagnosticMessages: [],
    },
    locationTimeline: {
      projectId: 'project-3',
      loadedAt: '2026-04-11T21:45:00.000Z',
      location: {
        id: 'location-grand-archive',
        title: 'Grand Archive',
        summary: 'A powder-dry archive where ledgers go missing in plain sight.',
        tags: ['records', 'investigation'],
        parentLocationId: null,
      },
      entries: [
        {
          kind: 'locationState',
          sequence: 1,
          id: 'location-state-grand-archive-initial',
          title: 'Grand Archive Before Visit',
          summary: 'Archive before visit.',
          status: 'active',
          notes: null,
          relatedEventIds: [],
          relatedEffectIds: ['effect-pattern-test-1'],
        },
        {
          kind: 'session',
          sequence: 2,
          id: 'session-mornqar-ledger',
          title: "Mornqar's Ledger",
          summary: 'Current live session.',
          notes: null,
          locationId: 'location-grand-archive',
          locationTitle: 'Grand Archive',
          startingLocationStateId: 'location-state-grand-archive-initial',
          startingLocationStateTitle: 'Grand Archive Before Visit',
          resultingLocationStateId: 'location-state-grand-archive-post-major-visit',
          resultingLocationStateTitle: 'Grand Archive After Major Visit',
          relatedLocationIds: ['location-skybridge-market'],
          relatedEventIds: ['event-now-project-3'],
          relatedEffectIds: ['effect-pattern-test-1'],
        },
      ],
      relatedEvents: [],
      relatedEffects: [],
      diagnosticMessages: [],
    },
    prep: {
      projectId: 'project-3',
      loadedAt: '2026-04-11T21:45:00.000Z',
      selectedLocationId: 'location-grand-archive',
      selectedLocationTitle: 'Grand Archive',
      answers: {
        whatChangedHereLastTime: {
          key: 'whatChangedHereLastTime',
          question: 'What changed here last time?',
          summary: 'Grand Archive last shifted during The Gilt Mask Auction.',
          bullets: ['Session: Past auction session.', 'After: Grand Archive After Major Visit'],
          references: [{ kind: 'session', id: 'session-gilt-mask-auction', title: 'The Gilt Mask Auction' }],
        },
        whatIsActiveNow: {
          key: 'whatIsActiveNow',
          question: 'What is active now?',
          summary: 'The active v2 anchor is Mornqar\'s Ledger at Grand Archive.',
          bullets: ['Current session: Current live session.', 'Active effects: Pattern Test 1'],
          references: [{ kind: 'session', id: 'session-mornqar-ledger', title: "Mornqar's Ledger" }],
        },
        whatBroaderEffectsAreInScope: {
          key: 'whatBroaderEffectsAreInScope',
          question: 'What broader effects are in scope?',
          summary: 'Grand Archive inherits broader pressure and may also have local modifiers that change how it plays.',
          bullets: ['Inherited effects: Pattern Test 1'],
          references: [{ kind: 'effect', id: 'effect-pattern-test-1', title: 'Pattern Test 1' }],
        },
        whatShouldIPrepNext: {
          key: 'whatShouldIPrepNext',
          question: 'What should I prep next?',
          summary: 'Prep should stay centered on Skybridge Market after the current scene.',
          bullets: ['Likely next locations: Skybridge Market (event-lead)'],
          references: [{ kind: 'location', id: 'location-skybridge-market', title: 'Skybridge Market' }],
        },
      },
    },
    authoring: {
      readOnly: true,
      readOnlyReason: 'Guided v2 authoring stays locked on shadow or experimental datasets. Switch to a primary campaign-v2 project to edit.',
      selectedLocationId: 'location-grand-archive',
      selectedLocationTitle: 'Grand Archive',
      locationOptions: [
        {
          id: 'location-grand-archive',
          title: 'Grand Archive',
          subtitle: 'A powder-dry archive where ledgers go missing in plain sight.',
          status: null,
        },
      ],
      parentLocationOptions: [
        {
          id: 'location-grand-archive',
          title: 'Grand Archive',
          subtitle: 'A powder-dry archive where ledgers go missing in plain sight.',
          status: null,
        },
      ],
      locationStateOptions: [],
      sessionOptions: [],
      followsSessionOptions: [],
      eventOptions: [],
      effectOptions: [],
      modifierEffectOptions: [],
      locationDrafts: [],
      locationStateDrafts: [],
      sessionDrafts: [],
      eventDrafts: [],
      effectDrafts: [],
      defaults: {
        location: {
          title: 'Grand Archive Child Location',
          summary: 'A new playable location tied to Grand Archive.',
          tagsText: 'investigation, records',
          parentLocationId: 'location-grand-archive',
        },
        locationState: {
          stage: 'initial',
          title: 'Grand Archive Before Visit',
          summary: 'Archive before visit.',
          status: 'available',
          notes: '',
        },
        session: {
          title: 'Visit Grand Archive',
          summary: 'A new play session anchored at Grand Archive.',
          notes: '',
          startingLocationStateId: null,
          resultingLocationStateId: null,
          followsSessionId: null,
        },
        event: {
          title: 'Scene at Grand Archive',
          summary: 'A discrete gameplay change tied to Grand Archive.',
          status: 'active',
          eventType: 'hook-progressed',
          notes: '',
          sessionId: null,
          threadId: '',
          createdEffectIds: [],
        },
        effect: {
          title: 'Pressure at Grand Archive',
          summary: 'An ongoing pressure or condition centered on Grand Archive.',
          status: 'active',
          effectType: 'pressure',
          scope: 'local',
          severity: 'medium',
          notes: '',
          modifierEffectId: null,
        },
      },
    },
    migrationChecklist: {
      projectId: 'project-3',
      contentSubdir: 'campaign-v2-shadow',
      validationCommand: 'npm run validate:campaign-v2 -- --project project-3',
      items: [
        {
          key: 'v2-only-writes',
          title: 'V2 is the only write path',
          status: 'complete',
          detail: 'Legacy dual-write is frozen. New authoring flows write campaign-v2 only.',
        },
      ],
    },
    contentSubdir: 'campaign-v2-shadow',
    trustedLocationDualWriteEnabled: false,
    counts: {
      locations: 7,
      locationStates: 10,
      sessions: 7,
      events: 12,
      effects: 5,
      invalidFiles: 0,
    },
    loadedAt: '2026-04-11T21:45:00.000Z',
  };
}

function createTrustedCampaignV2InspectorPayload(): CampaignV2InspectorPayload {
  return {
    project: {
      id: 'mornqar-alkenstar',
      name: 'Mornqar: Alkenstar',
      status: 'active',
      hasCampaignV2Content: true,
      preferredContentSubdir: 'campaign-v2',
    },
    projects: [
      {
        id: 'project-3',
        name: 'Hundred Notes Test',
        status: 'active',
        hasCampaignV2Content: true,
        preferredContentSubdir: 'campaign-v2-shadow',
      },
      {
        id: 'mornqar-alkenstar',
        name: 'Mornqar: Alkenstar',
        status: 'active',
        hasCampaignV2Content: true,
        preferredContentSubdir: 'campaign-v2',
      },
    ],
    selectedLocationId: 'location-barrel-and-bullet-saloon',
    locations: [
      {
        id: 'location-alkenstar',
        title: 'Alkenstar',
        summary: 'A soot-choked industrial city full of pressure and opportunity.',
        tags: ['city', 'industrial'],
        parentLocationId: null,
      },
      {
        id: 'location-barrel-and-bullet-saloon',
        title: 'Barrel & Bullet Saloon',
        summary: 'A dependable saloon and safehouse in the Ferrous Quarter.',
        tags: ['saloon', 'safehouse'],
        parentLocationId: 'location-alkenstar',
      },
    ],
    overview: {
      projectId: 'mornqar-alkenstar',
      loadedAt: '2026-04-11T22:10:00.000Z',
      previousSession: null,
      currentSession: null,
      likelyNextLocations: [],
      relatedEvents: [],
      relatedEffects: [],
      diagnosticMessages: [],
    },
    locationTimeline: {
      projectId: 'mornqar-alkenstar',
      loadedAt: '2026-04-11T22:10:00.000Z',
      location: {
        id: 'location-barrel-and-bullet-saloon',
        title: 'Barrel & Bullet Saloon',
        summary: 'A dependable saloon and safehouse in the Ferrous Quarter.',
        tags: ['saloon', 'safehouse'],
        parentLocationId: 'location-alkenstar',
      },
      entries: [],
      relatedEvents: [],
      relatedEffects: [],
      diagnosticMessages: [],
    },
    prep: {
      projectId: 'mornqar-alkenstar',
      loadedAt: '2026-04-11T22:10:00.000Z',
      selectedLocationId: 'location-barrel-and-bullet-saloon',
      selectedLocationTitle: 'Barrel & Bullet Saloon',
      answers: {
        whatChangedHereLastTime: {
          key: 'whatChangedHereLastTime',
          question: 'What changed here last time?',
          summary: 'No earlier session history is linked to Barrel & Bullet Saloon yet.',
          bullets: ['The location can still be prepped from its current state, but there is not a recorded prior visit to summarize.'],
          references: [{ kind: 'location', id: 'location-barrel-and-bullet-saloon', title: 'Barrel & Bullet Saloon' }],
        },
        whatIsActiveNow: {
          key: 'whatIsActiveNow',
          question: 'What is active now?',
          summary: 'There is no active v2 session anchor yet, so active pressure comes from events and effects only.',
          bullets: ['No current session is marked active.'],
          references: [],
        },
        whatBroaderEffectsAreInScope: {
          key: 'whatBroaderEffectsAreInScope',
          question: 'What broader effects are in scope?',
          summary: 'Barrel & Bullet Saloon does not currently inherit any broader v2 effects.',
          bullets: ['Prep can focus on the local state and directly attached events without city-wide or subtree pressure leaking in.'],
          references: [{ kind: 'location', id: 'location-barrel-and-bullet-saloon', title: 'Barrel & Bullet Saloon' }],
        },
        whatShouldIPrepNext: {
          key: 'whatShouldIPrepNext',
          question: 'What should I prep next?',
          summary: 'Prep should start with the most connected v2 location and its active pressure.',
          bullets: ['No next-location hints are linked yet.'],
          references: [],
        },
      },
    },
    authoring: {
      readOnly: false,
      readOnlyReason: null,
      selectedLocationId: 'location-barrel-and-bullet-saloon',
      selectedLocationTitle: 'Barrel & Bullet Saloon',
      locationOptions: [
        {
          id: 'location-alkenstar',
          title: 'Alkenstar',
          subtitle: 'A soot-choked industrial city full of pressure and opportunity.',
          status: null,
        },
        {
          id: 'location-barrel-and-bullet-saloon',
          title: 'Barrel & Bullet Saloon',
          subtitle: 'A dependable saloon and safehouse in the Ferrous Quarter.',
          status: null,
        },
      ],
      parentLocationOptions: [
        {
          id: 'location-alkenstar',
          title: 'Alkenstar',
          subtitle: 'A soot-choked industrial city full of pressure and opportunity.',
          status: null,
        },
        {
          id: 'location-barrel-and-bullet-saloon',
          title: 'Barrel & Bullet Saloon',
          subtitle: 'A dependable saloon and safehouse in the Ferrous Quarter.',
          status: null,
        },
      ],
      locationStateOptions: [
        {
          id: 'location-state-barrel-and-bullet-saloon-initial',
          title: 'Barrel & Bullet Before Visit',
          subtitle: 'The saloon is still a usable safehouse.',
          status: 'available',
        },
      ],
      sessionOptions: [
        {
          id: 'session-alkenstar-opening-pressure',
          title: 'Opening Pressure',
          subtitle: 'Barrel & Bullet Saloon · The first night of pressure in Alkenstar.',
          status: null,
        },
      ],
      followsSessionOptions: [
        {
          id: 'session-alkenstar-opening-pressure',
          title: 'Opening Pressure',
          subtitle: 'Barrel & Bullet Saloon · The first night of pressure in Alkenstar.',
          status: null,
        },
      ],
      eventOptions: [
        {
          id: 'event-foebe-job-offer',
          title: 'Foebe Offers a Job',
          subtitle: 'Foebe points the party at a Mugland courier lane.',
          status: 'active',
        },
      ],
      effectOptions: [
        {
          id: 'effect-saloon-pressure',
          title: 'Saloon Pressure',
          subtitle: 'The saloon is feeling Mugland pressure.',
          status: 'local · medium',
        },
      ],
      modifierEffectOptions: [
        {
          id: 'effect-saloon-pressure',
          title: 'Saloon Pressure',
          subtitle: 'The saloon is feeling Mugland pressure.',
          status: 'local · medium',
        },
      ],
      locationDrafts: [
        {
          id: 'location-barrel-and-bullet-saloon',
          title: 'Barrel & Bullet Saloon',
          summary: 'A dependable saloon and safehouse in the Ferrous Quarter.',
          tags: ['saloon', 'safehouse'],
          parentLocationId: 'location-alkenstar',
        },
      ],
      locationStateDrafts: [
        {
          id: 'location-state-barrel-and-bullet-saloon-initial',
          locationId: 'location-barrel-and-bullet-saloon',
          title: 'Barrel & Bullet Before Visit',
          summary: 'The saloon is still a usable safehouse.',
          status: 'available',
          notes: 'Foebe can broker introductions here.',
        },
      ],
      sessionDrafts: [
        {
          id: 'session-alkenstar-opening-pressure',
          locationId: 'location-barrel-and-bullet-saloon',
          title: 'Opening Pressure',
          summary: 'The first night of pressure in Alkenstar.',
          notes: 'Use this to launch the first saloon-centered session.',
          startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
          resultingLocationStateId: null,
          followsSessionId: null,
        },
      ],
      eventDrafts: [
        {
          id: 'event-foebe-job-offer',
          title: 'Foebe Offers a Job',
          summary: 'Foebe points the party at a Mugland courier lane.',
          status: 'active',
          notes: 'This is the starter hook event.',
          eventType: 'hook-progressed',
          locationId: 'location-barrel-and-bullet-saloon',
          sessionId: 'session-alkenstar-opening-pressure',
          threadId: 'thread-mugland-courier',
          createdEffectIds: [],
        },
      ],
      effectDrafts: [
        {
          id: 'effect-saloon-pressure',
          title: 'Saloon Pressure',
          summary: 'The saloon is feeling Mugland pressure.',
          status: 'active',
          notes: 'Foebe is tense but still open for business.',
          effectType: 'pressure',
          scope: 'local',
          severity: 'medium',
          locationId: 'location-barrel-and-bullet-saloon',
          modifierEffectId: null,
        },
      ],
      defaults: {
        location: {
          title: 'Barrel & Bullet Saloon Child Location',
          summary: 'A new playable location tied to Barrel & Bullet Saloon.',
          tagsText: 'safehouse, saloon',
          parentLocationId: 'location-barrel-and-bullet-saloon',
        },
        locationState: {
          stage: 'initial',
          title: 'Barrel & Bullet Before Visit',
          summary: 'The saloon is still a usable safehouse.',
          status: 'available',
          notes: '',
        },
        session: {
          title: 'Visit Barrel & Bullet Saloon',
          summary: 'A new play session anchored at Barrel & Bullet Saloon.',
          notes: '',
          startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
          resultingLocationStateId: null,
          followsSessionId: 'session-alkenstar-opening-pressure',
        },
        event: {
          title: 'Scene at Barrel & Bullet Saloon',
          summary: 'A discrete gameplay change tied to Barrel & Bullet Saloon.',
          status: 'active',
          eventType: 'hook-progressed',
          notes: '',
          sessionId: 'session-alkenstar-opening-pressure',
          threadId: '',
          createdEffectIds: [],
        },
        effect: {
          title: 'Pressure at Barrel & Bullet Saloon',
          summary: 'An ongoing pressure or condition centered on Barrel & Bullet Saloon.',
          status: 'active',
          effectType: 'pressure',
          scope: 'local',
          severity: 'medium',
          notes: '',
          modifierEffectId: 'effect-saloon-pressure',
        },
      },
    },
    migrationChecklist: {
      projectId: 'mornqar-alkenstar',
      contentSubdir: 'campaign-v2',
      validationCommand: 'npm run validate:campaign-v2 -- --project mornqar-alkenstar',
      items: [
        {
          key: 'v2-only-writes',
          title: 'V2 is the only write path',
          status: 'complete',
          detail: 'Legacy dual-write is frozen. New authoring flows write campaign-v2 only.',
        },
      ],
    },
    contentSubdir: 'campaign-v2',
    trustedLocationDualWriteEnabled: false,
    counts: {
      locations: 2,
      locationStates: 2,
      sessions: 0,
      events: 0,
      effects: 0,
      invalidFiles: 0,
    },
    loadedAt: '2026-04-11T22:10:00.000Z',
  };
}

describe('timeline page', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthSession.role = 'gm';
    mockAuthSession.userId = 'gm-1';
    mockAuthSession.username = 'Admingm';
    mockSearchParamsState.surface = null;
    mockSearchParamsState.location = null;
    mockReplace.mockReset();
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/campaign-v2/dual-write/location')) {
        return {
          ok: true,
          json: async () => ({
            payload: structuredClone(createTrustedCampaignV2InspectorPayload()),
            report: {
              flow: 'trusted-location-identity',
              projectId: 'mornqar-alkenstar',
              locationId: 'location-barrel-and-bullet-saloon',
              placeId: 'place-barrel-and-bullet-saloon',
              success: true,
              divergence: false,
              divergenceReasons: [],
              oldWrite: {
                model: 'old',
                targetId: 'place-barrel-and-bullet-saloon',
                relativePath: 'places/place-barrel-and-bullet-saloon.json',
                success: true,
                message: 'Wrote place file and updated place index.',
                data: {
                  title: 'Barrel & Bullet Saloon',
                  summary: 'A dependable saloon and safehouse in the Ferrous Quarter.',
                  tags: ['saloon', 'safehouse'],
                },
              },
              newWrite: {
                model: 'new',
                targetId: 'location-barrel-and-bullet-saloon',
                relativePath: 'locations/location-barrel-and-bullet-saloon.json',
                success: true,
                message: 'Wrote v2 location file.',
                data: {
                  title: 'Barrel & Bullet Saloon',
                  summary: 'A dependable saloon and safehouse in the Ferrous Quarter.',
                  tags: ['saloon', 'safehouse'],
                },
              },
            },
          }),
        };
      }

      if (url.includes('/api/campaign-v2/authoring')) {
        const payload = structuredClone(createTrustedCampaignV2InspectorPayload());
        const locationTimeline = payload.locationTimeline!;
        const authoring = payload.authoring!;

        locationTimeline.entries = [
          ...locationTimeline.entries,
          {
            kind: 'session',
            sequence: 1,
            id: 'session-saloon-followup',
            title: 'Saloon Follow-up',
            summary: 'A fresh session created from the guided authoring panel.',
            notes: 'Generated by the test authoring flow.',
            locationId: 'location-barrel-and-bullet-saloon',
            locationTitle: 'Barrel & Bullet Saloon',
            startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
            startingLocationStateTitle: 'Barrel & Bullet Before Visit',
            resultingLocationStateId: null,
            resultingLocationStateTitle: null,
            relatedLocationIds: [],
            relatedEventIds: [],
            relatedEffectIds: [],
          },
        ];
        payload.authoring = {
          ...authoring,
          sessionOptions: [
            ...authoring.sessionOptions,
            {
              id: 'session-saloon-followup',
              title: 'Saloon Follow-up',
              subtitle: 'Barrel & Bullet Saloon · A fresh session created from the guided authoring panel.',
              status: null,
            },
          ],
          sessionDrafts: [
            ...authoring.sessionDrafts,
            {
              id: 'session-saloon-followup',
              locationId: 'location-barrel-and-bullet-saloon',
              title: 'Saloon Follow-up',
              summary: 'A fresh session created from the guided authoring panel.',
              notes: 'Generated by the test authoring flow.',
              startingLocationStateId: 'location-state-barrel-and-bullet-saloon-initial',
              resultingLocationStateId: null,
              followsSessionId: 'session-alkenstar-opening-pressure',
            },
          ],
        };

        return {
          ok: true,
          json: async () => ({
            payload,
            result: {
              action: 'created',
              entityKind: 'session',
              entityId: 'session-saloon-followup',
              entityTitle: 'Saloon Follow-up',
              message: 'Created session Saloon Follow-up.',
              selectedLocationId: 'location-barrel-and-bullet-saloon',
            },
          }),
        };
      }

      if (url.includes('/api/campaign-v2/inspector')) {
        if (url.includes('project=mornqar-alkenstar')) {
          return {
            ok: true,
            json: async () => structuredClone(createTrustedCampaignV2InspectorPayload()),
          };
        }

        return {
          ok: true,
          json: async () => structuredClone(createCampaignV2InspectorPayload()),
        };
      }

      return {
        ok: true,
        json: async () => structuredClone(createBoardPayload()),
      };
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the gm board with one visible past session and the current session centered', async () => {
    mockSearchParamsState.surface = 'classic';

    render(<TimelinePage />);

    await waitFor(() => {
      expect(screen.getByTestId('gm-timeline-board')).toBeInTheDocument();
    });

    expect(screen.getByTestId('legacy-timeline-fallback-banner')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-current-session')).toHaveTextContent("Mornqar's Ledger");
    expect(screen.getByTestId('timeline-session-session-past-auction')).toBeInTheDocument();
    expect(screen.queryByTestId('timeline-session-session-past-docks')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Earlier sessions \(1\)/i })).toBeInTheDocument();
  });

  it('refreshes the board from the loader route and shows success feedback', async () => {
    const user = userEvent.setup();
    mockSearchParamsState.surface = 'classic';

    render(<TimelinePage />);

    await waitFor(() => {
      expect(screen.getByTestId('gm-timeline-board')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('gm-timeline-refresh'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Refreshed successfully.');
  });

  it('blocks non-gm roles from the board', async () => {
    mockAuthSession.role = 'helper';

    render(<TimelinePage />);

    expect(screen.getByText('The campaign-v2 inspector is GM-only in this phase.')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('defaults to the v2 inspector surface', async () => {
    render(<TimelinePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hundred Notes Test' })).toBeInTheDocument();
    });

    expect(screen.getByTestId('campaign-v2-inspector')).toBeInTheDocument();
    expect(screen.getByText('Campaign V2 Inspector')).toBeInTheDocument();
    expect(screen.getAllByText("Mornqar's Ledger").length).toBeGreaterThan(0);
    expect(screen.getByText('Grand Archive Before Visit')).toBeInTheDocument();
    expect(screen.getByText('Prep Answers')).toBeInTheDocument();
    expect(screen.getByText('Migration Status')).toBeInTheDocument();
    expect(screen.getByText('What is active now?')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaign-v2/inspector?project=project-3',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('keeps the legacy write bridge hidden on the primary campaign-v2 surface', async () => {
    mockSearchParamsState.project = 'mornqar-alkenstar';

    render(<TimelinePage />);

    await waitFor(() => {
      expect(screen.getByText('Guided V2 Authoring')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Save dual-write' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Legacy dual-write is frozen/i).length).toBeGreaterThan(0);
  });

  it('renders guided v2 authoring and posts session creation through the authoring route', async () => {
    const user = userEvent.setup();
    mockSearchParamsState.project = 'mornqar-alkenstar';

    render(<TimelinePage />);

    await waitFor(() => {
      expect(screen.getByText('Guided V2 Authoring')).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('author session title'));
    await user.type(screen.getByLabelText('author session title'), 'Saloon Follow-up');
    await user.clear(screen.getByLabelText('author session summary'));
    await user.type(screen.getByLabelText('author session summary'), 'A fresh session created from the guided authoring panel.');
    await user.click(screen.getByRole('button', { name: 'Create session' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaign-v2/authoring',
        expect.objectContaining({
          method: 'POST',
          cache: 'no-store',
        }),
      );
    });

    expect(screen.getByRole('status')).toHaveTextContent('Created session Saloon Follow-up.');
  });
});
