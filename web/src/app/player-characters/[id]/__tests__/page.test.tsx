import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CampaignV2PlayerCharacterPagePayload } from '@/features/campaign-v2/types';

import PlayerCharacterPage from '../page';

const mockFetchCampaignV2PlayerCharacter = vi.fn();
const mockReplace = vi.fn();
const mockCampaignSelectionState = {
  selectedProjectId: 'project-1',
  selectionReady: true,
};

const mockAuthSession = {
  role: 'gm',
  userId: 'gm-1',
  username: 'Admingm',
};

vi.mock('@/features/campaign-v2/api', () => ({
  fetchCampaignV2PlayerCharacter: (...args: unknown[]) => mockFetchCampaignV2PlayerCharacter(...args),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    ...mockAuthSession,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/contexts/campaign-selection-context', () => ({
  useCampaignSelection: () => ({
    selectedProjectId: mockCampaignSelectionState.selectedProjectId,
    selectionReady: mockCampaignSelectionState.selectionReady,
    projectOptions: [],
    isCampaignScopedRoute: true,
    buildCampaignHref: (href: string) => href,
    selectProject: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'project' ? 'project-1' : null),
    toString: () => 'project=project-1',
  }),
}));

afterEach(() => {
  cleanup();
});

function createPayload(): CampaignV2PlayerCharacterPagePayload {
  return {
    project: {
      id: 'project-1',
      name: 'Harbor of Whispers',
      status: 'active',
      hasCampaignV2Content: true,
      preferredContentSubdir: 'campaign-v2-shadow',
    },
    projects: [
      {
        id: 'project-1',
        name: 'Harbor of Whispers',
        status: 'active',
        hasCampaignV2Content: true,
        preferredContentSubdir: 'campaign-v2-shadow',
      },
    ],
    selectedPlayerCharacterId: 'pc-raina-kestrel',
    playerCharacters: [
      {
        id: 'pc-raina-kestrel',
        title: 'Raina Kestrel',
        summary: 'A scout who turns ritual clues into pressure.',
        status: 'active',
        concept: 'Streetwise clue hound',
        partyRole: 'Scout',
      },
    ],
    detail: {
      projectId: 'project-1',
      loadedAt: '2026-04-12T00:00:00.000Z',
      playerCharacter: {
        id: 'pc-raina-kestrel',
        title: 'Raina Kestrel',
        summary: 'A scout who turns ritual clues into pressure.',
        status: 'active',
        concept: 'Streetwise clue hound',
        partyRole: 'Scout',
        ancestry: 'Human',
        characterClass: 'Investigator',
        age: 24,
        background: {
          origin: 'Ash Market',
          history: 'Courier turned clue-hunter.',
          incitingIncident: 'Found ritual wax in the wrong bag.',
          reasonInCity: 'Needs to stop the ritual network.',
        },
        currentSituation: {
          overview: 'Working the market and chapel together.',
          legalStatus: 'Questioned, not charged.',
          socialStatus: 'Useful but disruptive.',
          currentProblem: 'Needs proof before witnesses disappear.',
          currentLocationId: 'location-entity-ruined-chapel',
          currentLocationTitle: 'Ruined Chapel',
          currentLocationHref: '/timeline?project=project-1&location=location-entity-ruined-chapel',
        },
        goals: {
          shortTerm: 'Keep the clue alive.',
          midTerm: 'Find the courier route.',
          longTerm: 'Break the ritual network.',
        },
        traits: {
          strengths: ['Observant'],
          flaws: ['Reckless'],
          personality: ['Dry humor'],
        },
        spotlight: {
          themes: ['Ritual fallout'],
          gmNotes: 'Push witness scenes.',
        },
        campaignFitSummary: 'Turns the chapel clue into a playable pressure line.',
        startingThreads: [
          {
            id: 'thread-stolen-relic',
            title: 'Stolen Reliquary',
            state: 'active',
            playerSummary: 'Someone swapped a chapel relic.',
            gmTruth: 'The reliquary feeds a harbor rite.',
            href: '/threads/thread-stolen-relic',
            missing: false,
          },
        ],
        coreThreads: [],
        relations: [
          {
            type: 'relatedTo',
            targetId: 'npc-brother-carrow',
            targetTitle: 'Brother Carrow',
            targetType: 'npc',
            note: 'Needs him talking.',
            status: null,
            strength: 'high',
            origin: null,
            active: true,
            href: null,
            missing: false,
          },
        ],
        linkedEntities: [
          {
            id: 'npc-brother-carrow',
            title: 'Brother Carrow',
            type: 'npc',
            summary: 'Reluctant witness',
            status: 'active',
            href: null,
            missing: false,
          },
        ],
        relationshipNotes: [
          {
            label: 'Brother Carrow',
            role: 'Witness contact',
            note: 'Needs reassurance before he names names.',
          },
        ],
        assets: {
          signatureItems: ['Wax-marked notebook'],
          specialCapabilities: ['Tracks ritual symbols'],
        },
        connections: {
          importantNpcs: [
            {
              id: 'npc-brother-carrow',
              title: 'Brother Carrow',
              type: 'npc',
              summary: 'Reluctant witness',
              status: 'active',
              href: null,
              missing: false,
            },
          ],
          importantLocations: [],
          importantThreads: [],
          importantHooks: [],
        },
        notes: 'High-visibility clue engine.',
      },
      diagnosticMessages: [],
    },
    contentSubdir: 'campaign-v2-shadow',
    loadedAt: '2026-04-12T00:00:00.000Z',
  };
}

describe('player character page', () => {
  beforeEach(() => {
    mockAuthSession.role = 'gm';
    mockCampaignSelectionState.selectedProjectId = 'project-1';
    mockCampaignSelectionState.selectionReady = true;
    mockFetchCampaignV2PlayerCharacter.mockReset();
    mockReplace.mockReset();
  });

  it('renders the main gm-facing character sections', async () => {
    mockFetchCampaignV2PlayerCharacter.mockResolvedValue(createPayload());

    render(<PlayerCharacterPage params={Promise.resolve({ id: 'pc-raina-kestrel' })} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Raina Kestrel' })).toBeInTheDocument();
    });

    expect(screen.getByText('Campaign Fit')).toBeInTheDocument();
    expect(screen.getByText('Current Situation')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('Traits')).toBeInTheDocument();
    expect(screen.getByText('Relations and Linked Entities')).toBeInTheDocument();
    expect(screen.getByText('GM Notes and Spotlight')).toBeInTheDocument();
    expect(screen.getByText('Stolen Reliquary')).toBeInTheDocument();
    expect(screen.getAllByText('Brother Carrow').length).toBeGreaterThan(0);
    expect(screen.getByText('Push witness scenes.')).toBeInTheDocument();
    expect(screen.queryByLabelText('player character project selector')).not.toBeInTheDocument();
    expect(screen.getByLabelText('player character selector')).toBeInTheDocument();
  });

  it('blocks player roles from the player character page', async () => {
    mockAuthSession.role = 'player';

    render(<PlayerCharacterPage params={Promise.resolve({ id: 'pc-raina-kestrel' })} />);

    expect(screen.getByText('The player character reference page is GM-only in this phase.')).toBeInTheDocument();
    expect(mockFetchCampaignV2PlayerCharacter).not.toHaveBeenCalled();
  });

  it('shows a not-found style empty state when the detail payload is missing', async () => {
    const payload = createPayload();
    payload.detail = null;
    payload.selectedPlayerCharacterId = null;
    mockFetchCampaignV2PlayerCharacter.mockResolvedValue(payload);

    render(<PlayerCharacterPage params={Promise.resolve({ id: 'pc-missing' })} />);

    await waitFor(() => {
      expect(screen.getByText('No v2 player character was found for this project.')).toBeInTheDocument();
    });
  });
});
