import { describe, expect, it } from 'vitest';

import { buildBoardGraph, summarizeTimelineAnchors } from '../graph';
import { getProjectBoardData } from '../mock-data';
import { buildPlayerPerspectiveAccess, scopeProjectBoardDataForPerspective } from '../perspective';
import { getBoardTimelineLabel, THREAD_STATE_META, type BoardLinkedEntity, type BoardPattern, type BoardThread, type ProjectBoardData } from '../types';

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

function findDerivedEdge(
  graph: ReturnType<typeof buildBoardGraph>,
  leftId: string,
  rightId: string,
) {
  return graph.edges.find(
    (edge) =>
      edge.connectionClass === 'derived' &&
      ((edge.source === leftId && edge.target === rightId) || (edge.source === rightId && edge.target === leftId)),
  );
}

describe('campaign board graph', () => {
  it('keeps inaccessible player-preview notes hidden for players but shows them as ghost context in gm preview mode', () => {
    const data = getProjectBoardData('project-1');
    const playerProfile = data.playerProfiles.find((profile) => profile.userId === 'player-1') ?? null;
    const perspectiveAccess = buildPlayerPerspectiveAccess(data, 'player', playerProfile);
    const scopedData = scopeProjectBoardDataForPerspective(data, 'player', playerProfile, perspectiveAccess);

    const gmGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const playerGraph = buildBoardGraph({
      data: scopedData,
      mode: 'player',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const gmPreviewGraph = buildBoardGraph({
      data,
      derivedData: scopedData,
      perspectiveAccess,
      showInaccessibleContext: true,
      mode: 'player',
      selectedNodeId: 'pattern-harbor-conspiracy',
      hoveredNodeId: null,
      focusedPatternId: 'pattern-harbor-conspiracy',
    });

    expect(gmGraph.nodes.some((node) => node.id === 'pattern-ash-ritual' && node.visible)).toBe(true);
    expect(playerGraph.nodes.some((node) => node.id === 'pattern-ash-ritual' && node.visible)).toBe(false);
    expect(gmPreviewGraph.nodes.find((node) => node.id === 'pattern-ash-ritual')).toEqual(
      expect.objectContaining({
        visible: true,
        accessibleInPerspective: false,
      }),
    );
  });

  it('reveals dormant pattern children when a cluster is focused', () => {
    const data = getProjectBoardData('project-1');
    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'pattern-ash-ritual',
      hoveredNodeId: null,
      focusedPatternId: 'pattern-ash-ritual',
    });

    expect(graph.nodes.find((node) => node.id === 'thread-ashes-chapel')?.visible).toBe(true);
    expect(graph.nodes.find((node) => node.id === 'thread-ashes-chapel')?.tone).toBe('dormant');
  });

  it('keeps graph positions stable for the same inputs', () => {
    const data = getProjectBoardData('project-2');
    const firstGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const secondGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(
      firstGraph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
      })),
    ).toEqual(
      secondGraph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
      })),
    );
  });

  it('keeps node positions stable even when derived connection scores change', () => {
    const data = getProjectBoardData('project-2');
    const strongerConnections: ProjectBoardData = {
      ...data,
      threads: data.threads.map((thread) =>
        thread.id === 'thread-south-march'
          ? {
              ...thread,
              linkedEntityIds: [...thread.linkedEntityIds, 'entity-signal-hill'],
            }
          : thread,
      ),
    };

    const baselineGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const changedGraph = buildBoardGraph({
      data: strongerConnections,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(
      baselineGraph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
      })),
    ).toEqual(
      changedGraph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
      })),
    );
  });

  it('keeps derived edges hidden by default and reveals strong and medium links on focus', () => {
    const data = getProjectBoardData('project-1');

    const baselineGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const focusedGraph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'thread-night-watch',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(findDerivedEdge(baselineGraph, 'thread-whispers-harbor', 'thread-night-watch')).toEqual(
      expect.objectContaining({
        tier: 'strong',
        visible: false,
      }),
    );
    expect(findDerivedEdge(baselineGraph, 'thread-night-watch', 'thread-stolen-relic')).toEqual(
      expect.objectContaining({
        tier: 'medium',
        visible: false,
      }),
    );
    expect(findDerivedEdge(focusedGraph, 'thread-night-watch', 'thread-stolen-relic')).toEqual(
      expect.objectContaining({
        tier: 'medium',
        visible: true,
      }),
    );
    expect(findDerivedEdge(focusedGraph, 'thread-whispers-harbor', 'thread-night-watch')).toEqual(
      expect.objectContaining({
        tier: 'strong',
        visible: true,
      }),
    );
  });

  it('keeps weak edges hidden while still counting them toward hub score', () => {
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
          state: 'active',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: ['entity-shared'],
          playerVisible: true,
        },
      ],
    });

    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'thread-a',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(findDerivedEdge(graph, 'thread-a', 'thread-b')).toEqual(
      expect.objectContaining({
        tier: 'weak',
        visible: false,
        strength: 2.5,
      }),
    );
    expect(graph.nodes.find((node) => node.id === 'thread-a')).toEqual(
      expect.objectContaining({
        hubScore: 2.5,
        strongConnectionCount: 0,
      }),
    );
  });

  it('excludes staged notes from graph nodes, derived edges, and timeline counts', () => {
    const data = createBoardData({
      patterns: [
        {
          id: 'pattern-live',
          title: 'Live Pattern',
          summary: 'Visible pattern',
          escalationLevel: 1,
          threadIds: ['thread-live'],
          playerVisible: true,
        },
        {
          id: 'pattern-staged',
          title: 'Staged Pattern',
          summary: 'Hidden tray pattern',
          escalationLevel: 1,
          threadIds: [],
          playerVisible: false,
          staging: {
            isStaged: true,
            trayAnchor: 'future_possible',
          },
        },
      ],
      threads: [
        {
          id: 'thread-live',
          title: 'Live Thread',
          state: 'active',
          playerSummary: 'Visible thread',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: 'pattern-live',
          playerVisible: true,
        },
        {
          id: 'thread-staged',
          title: 'Staged Thread',
          state: 'dormant',
          playerSummary: '',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          playerVisible: false,
          staging: {
            isStaged: true,
            trayAnchor: 'now',
          },
        },
      ],
    });

    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(graph.nodes.some((node) => node.id === 'thread-staged')).toBe(false);
    expect(graph.nodes.some((node) => node.id === 'pattern-staged')).toBe(false);
    expect(graph.derivedEdges.some((edge) => edge.sourceId === 'thread-staged' || edge.targetId === 'thread-staged')).toBe(false);
    expect(summarizeTimelineAnchors(data, 'gm')).toEqual({
      past: 0,
      now: 1,
      future: 0,
    });
  });

  it('shows an activated staged pattern once it has a visible manual link', () => {
    const data = createBoardData({
      patterns: [
        {
          id: 'pattern-live',
          title: 'Live Pattern',
          summary: 'Visible pattern',
          escalationLevel: 1,
          threadIds: ['thread-live'],
          playerVisible: true,
        },
        {
          id: 'pattern-activated',
          title: 'Activated Pattern',
          summary: 'Now visible through manual link',
          escalationLevel: 1,
          threadIds: [],
          playerVisible: false,
        },
      ],
      threads: [
        {
          id: 'thread-live',
          title: 'Live Thread',
          state: 'active',
          playerSummary: 'Visible thread',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: 'pattern-live',
          playerVisible: true,
        },
      ],
    });

    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'pattern-activated',
      hoveredNodeId: null,
      focusedPatternId: null,
      manualLinks: [
        {
          id: 'manual-pattern-activated-thread-live',
          sourceId: 'pattern-activated',
          targetId: 'thread-live',
        },
      ],
    });

    expect(graph.nodes.find((node) => node.id === 'pattern-activated')).toEqual(
      expect.objectContaining({
        visible: true,
      }),
    );
  });

  it('renders manual links as visible board edges and skips canonical duplicates', () => {
    const data = createBoardData({
      patterns: [
        {
          id: 'pattern-pressure',
          title: 'Pressure Cluster',
          summary: 'Linked cluster',
          escalationLevel: 2,
          threadIds: ['thread-a', 'thread-b'],
          playerVisible: true,
        },
      ],
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'active',
          playerSummary: 'A',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: 'pattern-pressure',
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'active',
          playerSummary: 'B',
          timelineAnchor: 'future_possible',
          linkedEntityIds: [],
          patternId: 'pattern-pressure',
          playerVisible: true,
        },
      ],
    });

    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'thread-a',
      hoveredNodeId: null,
      focusedPatternId: null,
      manualLinks: [
        {
          id: 'manual-thread-a-thread-b',
          sourceId: 'thread-a',
          targetId: 'thread-b',
        },
        {
          id: 'manual-pattern-pressure-thread-a',
          sourceId: 'pattern-pressure',
          targetId: 'thread-a',
        },
      ],
    });

    expect(graph.manualEdges).toEqual([
      expect.objectContaining({
        id: 'manual-thread-a-thread-b',
        source: 'thread-a',
        target: 'thread-b',
        connectionClass: 'manual',
        visible: true,
      }),
    ]);
    expect(graph.edges.some((edge) => edge.id === 'manual-pattern-pressure-thread-a')).toBe(false);
  });

  it('keeps thread node sizes fixed even when strong connections increase', () => {
    const pattern: BoardPattern = {
      id: 'pattern-pressure',
      title: 'Pressure Cluster',
      summary: 'Three threads pulling on the same moment',
      escalationLevel: 2,
      threadIds: ['thread-a', 'thread-b', 'thread-c'],
      playerVisible: true,
    };
    const baseData = createBoardData({
      patterns: [pattern],
      threads: [
        {
          id: 'thread-a',
          title: 'Thread A',
          state: 'dormant',
          playerSummary: 'A',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
        {
          id: 'thread-b',
          title: 'Thread B',
          state: 'active',
          playerSummary: 'B',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
        {
          id: 'thread-c',
          title: 'Thread C',
          state: 'active',
          playerSummary: 'C',
          timelineAnchor: 'now',
          linkedEntityIds: [],
          patternId: pattern.id,
          playerVisible: true,
        },
      ],
    });
    const escalatedData: ProjectBoardData = {
      ...baseData,
      threads: baseData.threads.map((thread) =>
        thread.id === 'thread-a'
          ? {
              ...thread,
              state: 'active',
            }
          : thread,
      ),
    };

    const dormantGraph = buildBoardGraph({
      data: baseData,
      mode: 'gm',
      selectedNodeId: pattern.id,
      hoveredNodeId: null,
      focusedPatternId: pattern.id,
    });
    const activeGraph = buildBoardGraph({
      data: escalatedData,
      mode: 'gm',
      selectedNodeId: pattern.id,
      hoveredNodeId: null,
      focusedPatternId: pattern.id,
    });

    expect(dormantGraph.nodes.find((node) => node.id === 'thread-a')).toEqual(
      expect.objectContaining({
        size: 38,
        strongConnectionCount: 0,
      }),
    );
    expect(activeGraph.nodes.find((node) => node.id === 'thread-a')).toEqual(
      expect.objectContaining({
        size: 38,
        strongConnectionCount: 2,
      }),
    );
  });

  it('provides the hundred-note stress campaign with fixed pattern clusters', () => {
    const data = getProjectBoardData('project-3');
    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(data.patterns).toHaveLength(5);
    expect(data.threads).toHaveLength(95);
    expect(data.patterns.every((pattern) => pattern.threadIds.length === 8)).toBe(true);
    expect(graph.nodes.filter((node) => node.type === 'pattern' && node.visible)).toHaveLength(5);
    expect(graph.nodes.filter((node) => node.type === 'thread' && node.visible)).toHaveLength(95);
    expect(graph.nodes.find((node) => node.type === 'pattern')?.size).toBe(57);
    expect(graph.nodes.find((node) => node.type === 'thread')?.size).toBe(38);
  });

  it('marks player-assigned pattern notes as player anchors', () => {
    const data = getProjectBoardData('project-1');
    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });

    expect(graph.nodes.find((node) => node.id === 'pattern-harbor-conspiracy')).toEqual(
      expect.objectContaining({
        isPlayerAnchor: true,
      }),
    );
    expect(graph.nodes.find((node) => node.id === 'pattern-silent-bell')).toEqual(
      expect.objectContaining({
        isPlayerAnchor: false,
      }),
    );
  });

  it('promotes the centered player note to now-sized dark-green anchor styling in player view', () => {
    const data = getProjectBoardData('project-1');
    const graph = buildBoardGraph({
      data,
      mode: 'player',
      selectedNodeId: 'pattern-harbor-conspiracy',
      hoveredNodeId: null,
      focusedPatternId: 'pattern-harbor-conspiracy',
      centerNodeId: 'pattern-harbor-conspiracy',
    });

    expect(graph.nodes.find((node) => node.id === 'pattern-harbor-conspiracy')).toEqual(
      expect.objectContaining({
        size: 84,
        isPlayerAnchor: true,
        isCenteredPlayerAnchor: true,
      }),
    );
    expect(graph.nodes.find((node) => node.id === 'now')).toEqual(
      expect.objectContaining({
        size: 57,
      }),
    );
  });

  it('keeps visible notes from overlapping in the hundred-note stress campaign', () => {
    const data = getProjectBoardData('project-3');
    const graph = buildBoardGraph({
      data,
      mode: 'gm',
      selectedNodeId: 'now',
      hoveredNodeId: null,
      focusedPatternId: null,
    });
    const visibleNodes = graph.nodes.filter((node) => node.visible);

    for (let leftIndex = 0; leftIndex < visibleNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < visibleNodes.length; rightIndex += 1) {
        const leftNode = visibleNodes[leftIndex];
        const rightNode = visibleNodes[rightIndex];
        const minimumDistance = leftNode.size / 2 + rightNode.size / 2;
        const actualDistance = Math.hypot(
          leftNode.position.x - rightNode.position.x,
          leftNode.position.y - rightNode.position.y,
        );

        expect(actualDistance).toBeGreaterThanOrEqual(minimumDistance);
      }
    }
  });

  it('maps thread states and timeline labels to board-safe display tokens', () => {
    expect(THREAD_STATE_META.escalated.label).toBe('Escalated');
    expect(THREAD_STATE_META.active.accent).toBe('#66d7ff');
    expect(getBoardTimelineLabel('future_possible')).toBe('Future');
  });

  it('summarizes visible timeline anchors for the board footer', () => {
    const data = getProjectBoardData('project-1');

    expect(summarizeTimelineAnchors(data, 'player')).toEqual({
      past: 2,
      now: 2,
      future: 2,
    });
  });
});
