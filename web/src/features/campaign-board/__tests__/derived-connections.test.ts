import { describe, expect, it } from 'vitest';

import { buildDerivedThreatEdges, getDerivedConnectionTier, scoreThreatPair } from '../graph';
import { getProjectBoardData } from '../mock-data';
import type { BoardLinkedEntity, BoardPattern, BoardThread, ProjectBoardData } from '../types';

function createBoardData({
  threads,
  patterns = [],
  linkedEntities = {},
}: {
  threads: BoardThread[];
  patterns?: BoardPattern[];
  linkedEntities?: Record<string, BoardLinkedEntity>;
}): ProjectBoardData {
  return {
    project: {
      id: 'project-test',
      name: 'Test Project',
      status: 'active',
    },
    now: {
      id: 'now',
      title: 'Current moment',
      playerSummary: 'Test pressure',
    },
    threads,
    patterns,
    linkedEntities,
    playerProfiles: [],
  };
}

describe('derived threat connection scoring', () => {
  it('scores shared pattern connections without unrelated bonuses', () => {
    const pattern: BoardPattern = {
      id: 'pattern-alpha',
      title: 'Pattern Alpha',
      summary: 'Shared pressure',
      escalationLevel: 1,
      threadIds: ['thread-a', 'thread-b'],
      playerVisible: true,
    };
    const data = createBoardData({
      patterns: [pattern],
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'dormant',
          playerSummary: 'A',
          timelineAnchor: 'past',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'dormant',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
      ],
    });

    const result = scoreThreatPair({
      leftThread: data.threads[0],
      rightThread: data.threads[1],
      mode: 'gm',
      data,
    });

    expect(result.strength).toBe(4);
    expect(result.reasons).toEqual([
      expect.objectContaining({
        kind: 'pattern',
        label: 'same pattern: Pattern Alpha',
        weight: 4,
      }),
    ]);
  });

  it('scores shared entities on their own', () => {
    const data = createBoardData({
      linkedEntities: {
        'entity-shared': {
          id: 'entity-shared',
          type: 'npc',
          name: 'Shared Witness',
          playerVisible: true,
        },
      },
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'dormant',
          playerSummary: 'A',
          timelineAnchor: 'past',
          linkedEntityIds: ['entity-shared'],
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'dormant',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: ['entity-shared'],
          playerVisible: true,
        },
      ],
    });

    const result = scoreThreatPair({
      leftThread: data.threads[0],
      rightThread: data.threads[1],
      mode: 'gm',
      data,
    });

    expect(result.strength).toBe(2);
    expect(result.reasons).toEqual([
      expect.objectContaining({
        kind: 'shared_entity',
        label: 'shared entity: Shared Witness',
        weight: 2,
      }),
    ]);
  });

  it('adds pressured pair bonuses for active threats', () => {
    const data = createBoardData({
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'active',
          playerSummary: 'A',
          timelineAnchor: 'past',
          linkedEntityIds: [],
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'escalated',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: [],
          playerVisible: true,
        },
      ],
    });

    const result = scoreThreatPair({
      leftThread: data.threads[0],
      rightThread: data.threads[1],
      mode: 'gm',
      data,
    });

    expect(result.strength).toBe(1.5);
    expect(result.reasons).toEqual([
      expect.objectContaining({
        kind: 'state',
        label: 'both pressured',
        weight: 1.5,
      }),
    ]);
  });

  it('applies the resolved thread penalty', () => {
    const pattern: BoardPattern = {
      id: 'pattern-alpha',
      title: 'Pattern Alpha',
      summary: 'Shared pressure',
      escalationLevel: 1,
      threadIds: ['thread-a', 'thread-b'],
      playerVisible: true,
    };
    const data = createBoardData({
      patterns: [pattern],
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'resolved',
          playerSummary: 'A',
          timelineAnchor: 'past',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'dormant',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
      ],
    });

    const result = scoreThreatPair({
      leftThread: data.threads[0],
      rightThread: data.threads[1],
      mode: 'gm',
      data,
    });

    expect(result.strength).toBe(3);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'pattern',
          label: 'same pattern: Pattern Alpha',
          weight: 4,
        }),
        expect.objectContaining({
          kind: 'state',
          label: 'resolved thread present',
          weight: -1,
        }),
      ]),
    );
  });

  it('maps tier thresholds correctly', () => {
    expect(getDerivedConnectionTier(6)).toBe('strong');
    expect(getDerivedConnectionTier(3)).toBe('medium');
    expect(getDerivedConnectionTier(1.5)).toBe('weak');
    expect(getDerivedConnectionTier(1.49)).toBeNull();
  });

  it('uses gm-only entity links in gm mode but not in player mode', () => {
    const data = getProjectBoardData('project-1');
    const nightWatch = data.threads.find((thread) => thread.id === 'thread-night-watch');
    const stolenReliquary = data.threads.find((thread) => thread.id === 'thread-stolen-relic');

    expect(nightWatch).toBeDefined();
    expect(stolenReliquary).toBeDefined();

    const gmResult = scoreThreatPair({
      leftThread: nightWatch!,
      rightThread: stolenReliquary!,
      mode: 'gm',
      data,
    });
    const playerResult = scoreThreatPair({
      leftThread: nightWatch!,
      rightThread: stolenReliquary!,
      mode: 'player',
      data,
    });

    expect(gmResult.strength).toBe(4);
    expect(playerResult.strength).toBe(2);
    expect(gmResult.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'shared_entity',
          label: 'shared entity: The Cinder Choir',
        }),
      ]),
    );
    expect(playerResult.reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'shared entity: The Cinder Choir',
        }),
      ]),
    );
  });

  it('never builds player-mode derived edges for hidden threads', () => {
    const data = getProjectBoardData('project-1');
    const playerEdges = buildDerivedThreatEdges({ data, mode: 'player' });

    expect(
      playerEdges.some(
        (edge) => edge.sourceId === 'thread-bell-ledger' || edge.targetId === 'thread-bell-ledger',
      ),
    ).toBe(false);
  });
});
