import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOARD_PROJECT_OPTIONS, getProjectBoardData } from '@/features/campaign-board/mock-data';

import ProjectPage from '../page';

const { mockAuthSession, mockProjectState, mockApiClient } = vi.hoisted(() => ({
  mockAuthSession: {
    role: 'gm',
    userId: 'gm-1',
    username: 'Admingm',
  },
  mockProjectState: {} as Record<string, ReturnType<typeof getProjectBoardData>>,
  mockApiClient: {
    getProjects: vi.fn(),
    getProjectGraph: vi.fn(),
    runProjectCommand: vi.fn(),
    undoProjectHistory: vi.fn(),
    redoProjectHistory: vi.fn(),
  },
}));

const mockLogout = vi.fn();
const mockPush = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    ...mockAuthSession,
    isAuthenticated: true,
    login: vi.fn(),
    logout: mockLogout,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

function cloneProject(projectId: string) {
  const source = getProjectBoardData(projectId);
  return structuredClone({
    ...source,
    manualLinks: [],
    sharing: {
      globalNodeIds: [],
      playerNodeIdsByPlayer: Object.fromEntries(source.playerProfiles.map((profile) => [profile.userId, []])),
    },
    revision: null,
    history: {
      totalRevisions: 1,
      headIndex: 0,
      canUndo: false,
      canRedo: false,
    },
  });
}

function addStagedFixtures(projectId: string) {
  const project = mockProjectState[projectId];

  project.threads.push({
    id: `${projectId}-staged-thread`,
    title: 'Staged Harbor Lead',
    state: 'dormant',
    playerSummary: '',
    timelineAnchor: 'now',
    linkedEntityIds: [],
    playerVisible: false,
    staging: {
      isStaged: true,
      trayAnchor: 'now',
    },
  });

  project.patterns.push({
    id: `${projectId}-staged-pattern`,
    title: 'Staged Ritual Pattern',
    summary: '',
    escalationLevel: 1,
    threadIds: [],
    playerVisible: false,
    staging: {
      isStaged: true,
      trayAnchor: 'future_possible',
    },
  });
}

function toGraphResponse(projectId: string) {
  const data = mockProjectState[projectId];

  return {
    project: data.project,
    now: data.now,
    threads: data.threads,
    patterns: data.patterns,
    linkedEntities: data.linkedEntities,
    playerProfiles: data.playerProfiles,
    manualLinks: data.manualLinks ?? [],
    sharing: data.sharing ?? { globalNodeIds: [], playerNodeIdsByPlayer: {} },
    edges: [],
    timelineSummary: { past: 0, now: 0, future: 0 },
    mode: 'gm' as const,
    revision: data.revision ?? null,
    history: data.history ?? {
      totalRevisions: 1,
      headIndex: 0,
      canUndo: false,
      canRedo: false,
    },
  };
}

vi.mock('@/lib/use-api-client', () => ({
  useApiClient: () => mockApiClient,
}));

describe('project board page', () => {
  async function renderProjectBoard() {
    render(<ProjectPage />);
    await waitFor(() => {
      expect(screen.getByTestId('board-canvas')).toBeInTheDocument();
    });
  }

  beforeEach(() => {
    mockAuthSession.role = 'gm';
    mockAuthSession.userId = 'gm-1';
    mockAuthSession.username = 'Admingm';
    for (const option of BOARD_PROJECT_OPTIONS) {
      mockProjectState[option.id] = cloneProject(option.id);
    }
    mockApiClient.getProjects.mockReset();
    mockApiClient.getProjects.mockImplementation(async () =>
      BOARD_PROJECT_OPTIONS.map((project) => ({
        id: project.id,
        name: project.name,
        status: 'active',
      })),
    );
    mockApiClient.getProjectGraph.mockReset();
    mockApiClient.getProjectGraph.mockImplementation(async (projectId: string) => toGraphResponse(projectId));
    mockApiClient.runProjectCommand.mockReset();
    mockApiClient.runProjectCommand.mockImplementation(async (projectId: string, command: Record<string, unknown>) => {
      const project = mockProjectState[projectId];

      if (command.kind === 'update_now') {
        project.now = {
          ...project.now,
          ...(typeof command.title === 'string' ? { title: command.title } : {}),
          ...(typeof command.playerSummary === 'string' ? { playerSummary: command.playerSummary } : {}),
          ...(typeof command.gmTruth === 'string' ? { gmTruth: command.gmTruth } : {}),
        };
      }

      if (command.kind === 'update_thread' && typeof command.threadId === 'string') {
        project.threads = project.threads.map((thread) =>
          thread.id === command.threadId
            ? {
                ...thread,
                ...(typeof command.title === 'string' ? { title: command.title } : {}),
                ...(typeof command.hook === 'string' ? { hook: command.hook } : {}),
                ...(typeof command.playerSummary === 'string' ? { playerSummary: command.playerSummary } : {}),
                ...(typeof command.gmTruth === 'string' ? { gmTruth: command.gmTruth } : {}),
                ...(typeof command.state === 'string' &&
                ['dormant', 'active', 'escalated', 'resolved'].includes(command.state)
                  ? { state: command.state as (typeof thread)['state'] }
                  : {}),
              }
            : thread,
        );
      }

      if (command.kind === 'update_pattern' && typeof command.patternId === 'string') {
        project.patterns = project.patterns.map((pattern) =>
          pattern.id === command.patternId
            ? {
                ...pattern,
                ...(typeof command.title === 'string' ? { title: command.title } : {}),
                ...(typeof command.summary === 'string' ? { summary: command.summary } : {}),
                ...(typeof command.escalationLevel === 'number'
                  ? { escalationLevel: command.escalationLevel }
                  : {}),
              }
            : pattern,
        );
      }

      if (command.kind === 'share_node_to_player' && typeof command.nodeId === 'string' && typeof command.playerUserId === 'string') {
        const playerNodeIds = project.sharing?.playerNodeIdsByPlayer?.[command.playerUserId] ?? [];
        project.sharing = {
          ...(project.sharing ?? { globalNodeIds: [], playerNodeIdsByPlayer: {} }),
          playerNodeIdsByPlayer: {
            ...(project.sharing?.playerNodeIdsByPlayer ?? {}),
            [command.playerUserId]: [...new Set([...playerNodeIds, command.nodeId])],
          },
        };
      }

      if (command.kind === 'share_node_to_all' && typeof command.nodeId === 'string') {
        project.sharing = {
          ...(project.sharing ?? { globalNodeIds: [], playerNodeIdsByPlayer: {} }),
          globalNodeIds: [...new Set([...(project.sharing?.globalNodeIds ?? []), command.nodeId])],
          playerNodeIdsByPlayer: project.sharing?.playerNodeIdsByPlayer ?? {},
        };
      }

      if (command.kind === 'create_thread' && typeof command.title === 'string') {
        project.threads.push({
          id: `thread-created-${project.threads.length + 1}`,
          title: command.title,
          state: 'dormant',
          hook: typeof command.hook === 'string' ? command.hook : undefined,
          playerSummary: typeof command.playerSummary === 'string' ? command.playerSummary : '',
          gmTruth: typeof command.gmTruth === 'string' ? command.gmTruth : undefined,
          timelineAnchor:
            command.trayAnchor === 'past' || command.trayAnchor === 'future_possible' ? command.trayAnchor : 'now',
          linkedEntityIds: [],
          playerVisible: false,
          staging: {
            isStaged: true,
            trayAnchor:
              command.trayAnchor === 'past' || command.trayAnchor === 'future_possible' ? command.trayAnchor : 'now',
          },
        });
      }

      if (command.kind === 'create_pattern' && typeof command.title === 'string') {
        project.patterns.push({
          id: `pattern-created-${project.patterns.length + 1}`,
          title: command.title,
          summary: typeof command.summary === 'string' ? command.summary : '',
          escalationLevel: typeof command.escalationLevel === 'number' ? command.escalationLevel : 1,
          threadIds: [],
          playerVisible: false,
          staging: {
            isStaged: true,
            trayAnchor:
              command.trayAnchor === 'past' || command.trayAnchor === 'future_possible' ? command.trayAnchor : 'now',
          },
        });
      }

      if (command.kind === 'activate_staged_note' && typeof command.noteId === 'string' && typeof command.targetNodeId === 'string') {
        const manualLinkId = `manual-${[command.noteId, command.targetNodeId].sort().join('-')}`;
        project.manualLinks = [
          ...(project.manualLinks ?? []),
          {
            id: manualLinkId,
            sourceId: [command.noteId, command.targetNodeId].sort()[0],
            targetId: [command.noteId, command.targetNodeId].sort()[1],
          },
        ];

        project.threads = project.threads.map((thread) =>
          thread.id === command.noteId
            ? {
                ...thread,
                state: 'active',
                playerVisible: false,
                staging: undefined,
              }
            : thread,
        );
        project.patterns = project.patterns.map((pattern) =>
          pattern.id === command.noteId
            ? {
                ...pattern,
                playerVisible: false,
                staging: undefined,
              }
            : pattern,
        );
      }

      return {
        revision: {
          id: 'revision-test',
          commandKind: String(command.kind),
          summary: `Applied ${command.kind}`,
          createdAt: '2026-04-05T00:00:00.000Z',
        },
        graph: toGraphResponse(projectId),
      };
    });
    mockApiClient.undoProjectHistory.mockReset();
    mockApiClient.undoProjectHistory.mockImplementation(async (projectId: string) => ({
      revision: {
        id: 'revision-undo',
        commandKind: 'undo',
        summary: 'Undid last change',
        createdAt: '2026-04-05T00:00:00.000Z',
      },
      graph: toGraphResponse(projectId),
    }));
    mockApiClient.redoProjectHistory.mockReset();
    mockApiClient.redoProjectHistory.mockImplementation(async (projectId: string) => ({
      revision: {
        id: 'revision-redo',
        commandKind: 'redo',
        summary: 'Redid last change',
        createdAt: '2026-04-05T00:00:00.000Z',
      },
      graph: toGraphResponse(projectId),
    }));
    mockLogout.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the board shell with NOW focused by default and opens thread cards on click', async () => {
    await renderProjectBoard();

    expect(screen.getByTestId('project-board')).toBeInTheDocument();
    expect(screen.getByTestId('board-canvas')).toBeInTheDocument();
    expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Current moment')).toBeInTheDocument();
    expect(screen.getByLabelText('Board zoom')).toHaveValue('100');
    expect(screen.queryByText('Each preview is centered on that player')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('graph-node-thread-whispers-harbor'));

    await waitFor(() => {
      expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Whispers in the Harbor')).toBeInTheDocument();
    });

    expect(screen.getByTestId('focus-card')).toHaveTextContent(
      'Dockworkers say someone is paying for silence at the piers.',
    );
    expect(screen.getByTestId('related-threats')).toHaveTextContent('Night Watch Vanishes');
    expect(screen.getByTestId('related-threats')).toHaveTextContent('same pattern: Harbor Conspiracy');
    expect(screen.getByRole('link', { name: 'Open Thread' })).toHaveAttribute(
      'href',
      '/threads/thread-whispers-harbor',
    );
  });

  it('updates player perspective dropdown options per campaign and lets GM open a player view from it', async () => {
    const user = userEvent.setup();

    await renderProjectBoard();

    expect(screen.getByRole('button', { name: 'Perspective' })).toHaveTextContent('GM View');

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    expect(screen.getByRole('option', { name: 'GM View' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Ash Circle' }));

    await waitFor(() => {
      expect(screen.getByTestId('focus-card')).toHaveTextContent('Ash and Ritual');
    });
    expect(screen.getByTestId('graph-node-pattern-harbor-conspiracy')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-pattern-lantern-routes')).toHaveAttribute('data-perspective-hidden', 'true');

    await user.click(screen.getByRole('button', { name: 'Campaign selector' }));
    await user.click(screen.getByRole('option', { name: 'The Red Signal' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Perspective' })).toHaveTextContent('GM View');
    });
    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    expect(screen.getByRole('option', { name: 'Beacon Runner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'River Courier' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Lantern Route' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'GM View' }));

    await user.click(screen.getByRole('button', { name: 'Campaign selector' }));
    await user.click(screen.getByRole('option', { name: 'Hundred Notes Test' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Perspective' })).toHaveTextContent('GM View');
    });
    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    expect(screen.getByRole('option', { name: 'Pattern Scout' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Crosswind Watch' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'River Courier' })).not.toBeInTheDocument();
  });

  it('lets GM users switch perspectives from the dropdown and hides gm truth blocks in player mode', async () => {
    const user = userEvent.setup();

    await renderProjectBoard();

    expect(screen.getByTestId('focus-card')).toHaveTextContent('GM Truth');

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    await user.click(screen.getByRole('option', { name: 'Dockside Watch' }));

    await waitFor(() => {
      expect(screen.queryByText('GM Truth')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    await user.click(screen.getByRole('option', { name: 'GM View' }));

    await waitFor(() => {
      expect(screen.getByTestId('focus-card')).toHaveTextContent('GM Truth');
    });
  });

  it('locks player accounts to player mode and opens their assigned player pattern by default', async () => {
    mockAuthSession.role = 'player';
    mockAuthSession.userId = 'player-1';
    mockAuthSession.username = 'Adminplayer';

    await renderProjectBoard();

    expect(screen.getByText('Player View')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GM View' })).not.toBeInTheDocument();
    expect(screen.queryByText('GM Truth')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('focus-card')).toHaveTextContent('Harbor Conspiracy');
    });
    expect(screen.getByTestId('focus-card')).toHaveTextContent('Cluster Focused');
  });

  it('uses each player profile pattern as the default player-view center', async () => {
    mockAuthSession.role = 'player';
    mockAuthSession.userId = 'player-2';
    mockAuthSession.username = 'Adminplayer2';

    await renderProjectBoard();

    await waitFor(() => {
      expect(screen.getByTestId('focus-card')).toHaveTextContent('Ash and Ritual');
    });
    expect(screen.queryByTestId('graph-node-pattern-lantern-routes')).not.toBeInTheDocument();
  });

  it('hides gm-only relationship reasons in player preview while keeping related threats explainable', async () => {
    const user = userEvent.setup();

    await renderProjectBoard();

    fireEvent.click(screen.getByTestId('graph-node-thread-night-watch'));

    await waitFor(() => {
      expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Night Watch Vanishes')).toBeInTheDocument();
    });

    expect(screen.getByTestId('related-threats')).toHaveTextContent('shared entity: The Cinder Choir');
    expect(screen.getByTestId('related-threats')).toHaveTextContent('Whispers in the Harbor');

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    await user.click(screen.getByRole('option', { name: 'Dockside Watch' }));

    await waitFor(() => {
      expect(screen.queryByText('shared entity: The Cinder Choir')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('focus-card')).toHaveTextContent('Night Watch Vanishes');
    expect(screen.getByTestId('related-threats')).toHaveTextContent('Whispers in the Harbor');
    expect(screen.getByTestId('related-threats')).toHaveTextContent('both pressured');
  });

  it('shows note sharing actions for gm and lets gm share a hidden note to the active player preview', async () => {
    const user = userEvent.setup();

    await renderProjectBoard();

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    await user.click(screen.getByRole('option', { name: 'Dockside Watch' }));

    const hiddenPatternNode = screen.getByTestId('graph-node-pattern-ash-ritual');
    expect(hiddenPatternNode).toHaveAttribute('data-perspective-hidden', 'true');

    fireEvent.contextMenu(hiddenPatternNode);

    expect(screen.getByRole('menuitem', { name: 'Share with Dockside Watch' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Shared with Ash Circle' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Share with all players' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Share with Dockside Watch' }));

    await waitFor(() => {
      expect(screen.getByTestId('graph-node-pattern-ash-ritual')).not.toHaveAttribute('data-perspective-hidden');
    });
  });

  it('shows staged notes in the gm timeline tray but hides them in player preview', async () => {
    const user = userEvent.setup();
    addStagedFixtures('project-1');

    await renderProjectBoard();

    expect(screen.getByTestId('staged-tray-now')).toHaveTextContent('Staged Harbor Lead');
    expect(screen.getByTestId('staged-tray-future')).toHaveTextContent('Staged Ritual Pattern');

    await user.click(screen.getByRole('button', { name: 'Perspective' }));
    await user.click(screen.getByRole('option', { name: 'Dockside Watch' }));

    await waitFor(() => {
      expect(screen.queryByTestId('staged-tray-now')).not.toBeInTheDocument();
    });
  });

  it('opens staged notes from the tray and lets gm create new staged notes from the now card', async () => {
    const user = userEvent.setup();
    addStagedFixtures('project-1');

    await renderProjectBoard();

    await user.click(screen.getByTestId('staged-note-chip-project-1-staged-thread'));

    await waitFor(() => {
      expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Staged Harbor Lead')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('graph-node-now'));

    await user.click(screen.getByTestId('new-thread-button'));
    await user.type(screen.getByTestId('new-thread-title-input'), 'Fresh Staged Thread');
    await user.click(screen.getByRole('button', { name: 'Create Thread' }));

    await waitFor(() => {
      expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Fresh Staged Thread')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('graph-node-now'));

    await user.click(screen.getByTestId('new-pattern-button'));
    await user.type(screen.getByTestId('new-pattern-title-input'), 'Fresh Staged Pattern');
    await user.click(screen.getByRole('button', { name: 'Create Pattern' }));

    await waitFor(() => {
      expect(within(screen.getByTestId('focus-card')).getByDisplayValue('Fresh Staged Pattern')).toBeInTheDocument();
    });
  });

  it('activates a staged note when the gm drags it from the tray onto a graph note', async () => {
    addStagedFixtures('project-1');

    await renderProjectBoard();

    const stagedChip = screen.getByTestId('staged-note-chip-project-1-staged-thread');
    const graphTarget = screen.getByTestId('graph-node-thread-whispers-harbor');
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    fireEvent.dragStart(stagedChip, { dataTransfer });
    fireEvent.dragOver(graphTarget, { dataTransfer });
    fireEvent.drop(graphTarget, { dataTransfer });
    fireEvent.dragEnd(stagedChip, { dataTransfer });

    await waitFor(() => {
      expect(screen.queryByTestId('staged-note-chip-project-1-staged-thread')).not.toBeInTheDocument();
    });

    expect(mockApiClient.runProjectCommand).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        kind: 'activate_staged_note',
        noteId: 'project-1-staged-thread',
        targetNodeId: 'thread-whispers-harbor',
      }),
    );
  });

  it('shows share actions for helper users but keeps edit gm-only', async () => {
    mockAuthSession.role = 'helper';
    mockAuthSession.userId = 'helper-1';
    mockAuthSession.username = 'Admingmhelper';

    await renderProjectBoard();

    fireEvent.contextMenu(screen.getByTestId('graph-node-pattern-ash-ritual'));

    expect(screen.getByRole('menuitem', { name: 'Share with Dockside Watch' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Share with all players' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows a logout menu item and routes back to login after logout', async () => {
    const user = userEvent.setup();

    await renderProjectBoard();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
