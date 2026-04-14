'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useCampaignSelection } from '@/contexts/campaign-selection-context';
import { useApiClient } from '@/lib/use-api-client';
import { canPreviewPlayerMode, canViewGmContent, getRoleLabel, normalizeFrontendRole } from '@/lib/roles';

import { toProjectBoardData } from './api-adapter';
import styles from './CampaignBoard.module.css';
import { buildBoardGraph, summarizeTimelineAnchors } from './graph';
import { buildPlayerPerspectiveAccess, scopeProjectBoardDataForPerspective } from './perspective';
import { StoryGraphCanvas } from './StoryGraphCanvas';
import {
  getBoardTimelineLabel,
  THREAD_STATE_META,
  type BoardManualLink,
  type BoardMode,
  type BoardPattern,
  type BoardStagedNote,
  type BoardThread,
  type BoardTimelineAnchor,
  type DerivedConnectionTier,
  type DerivedThreatEdge,
  type ProjectBoardData,
} from './types';

const CONNECTION_TIER_LABELS: Record<DerivedConnectionTier, string> = {
  strong: 'Strong',
  medium: 'Medium',
  weak: 'Weak',
};

const EMPTY_PROJECT_BOARD_DATA: ProjectBoardData = {
  project: {
    id: '',
    name: '',
    status: 'active',
  },
  now: {
    id: 'now',
    title: 'Current moment',
    playerSummary: '',
  },
  threads: [],
  patterns: [],
  linkedEntities: {},
  playerProfiles: [],
  manualLinks: [],
  sharing: {
    globalNodeIds: [],
    playerNodeIdsByPlayer: {},
  },
  revision: null,
  history: {
    totalRevisions: 0,
    headIndex: 0,
    canUndo: false,
    canRedo: false,
  },
};

function formatConnectionStrength(strength: number): string {
  return Number.isInteger(strength) ? `${strength}` : strength.toFixed(1);
}

function toManualLinkPair(sourceId: string, targetId: string) {
  return [sourceId, targetId].sort((left, right) => left.localeCompare(right));
}

function createManualLink(sourceId: string, targetId: string): BoardManualLink {
  const [leftId, rightId] = toManualLinkPair(sourceId, targetId);

  return {
    id: `manual-${leftId}-${rightId}`,
    sourceId: leftId,
    targetId: rightId,
  };
}

type NodeContextMenuState = {
  nodeId: string;
  clientX: number;
  clientY: number;
};

type TopBarSelectOption = {
  value: string;
  label: string;
};

type ThreadDraft = {
  title: string;
  hook: string;
  playerSummary: string;
  gmTruth: string;
  state: BoardThread['state'];
};

type PatternDraft = {
  title: string;
  summary: string;
  escalationLevel: number;
};

type NowDraft = {
  title: string;
  playerSummary: string;
  gmTruth: string;
};

type StagedNoteCreationInput = {
  title: string;
  trayAnchor: BoardTimelineAnchor;
};

function isStagedThread(thread: BoardThread | null | undefined): thread is BoardThread & { staging: NonNullable<BoardThread['staging']> } {
  return thread?.staging?.isStaged === true;
}

function isStagedPattern(
  pattern: BoardPattern | null | undefined,
): pattern is BoardPattern & { staging: NonNullable<BoardPattern['staging']> } {
  return pattern?.staging?.isStaged === true;
}

function toTimelineSegmentKey(anchor: BoardTimelineAnchor): 'past' | 'now' | 'future' {
  return anchor === 'future_possible' ? 'future' : anchor;
}

function toThreadDraft(thread: BoardThread): ThreadDraft {
  return {
    title: thread.title,
    hook: thread.hook ?? '',
    playerSummary: thread.playerSummary,
    gmTruth: thread.gmTruth ?? '',
    state: thread.state,
  };
}

function toPatternDraft(pattern: BoardPattern): PatternDraft {
  return {
    title: pattern.title,
    summary: pattern.summary,
    escalationLevel: pattern.escalationLevel,
  };
}

function toNowDraft(nowSummary: ProjectBoardData['now']): NowDraft {
  return {
    title: nowSummary.title,
    playerSummary: nowSummary.playerSummary,
    gmTruth: nowSummary.gmTruth ?? '',
  };
}

function areThreadDraftsEqual(left: ThreadDraft | null, right: ThreadDraft | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function arePatternDraftsEqual(left: PatternDraft | null, right: PatternDraft | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areNowDraftsEqual(left: NowDraft | null, right: NowDraft | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function TopBarSelect({
  label,
  ariaLabel,
  value,
  options,
  onSelect,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  options: TopBarSelectOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.fieldSelect}>
      <span className={styles.fieldLabel}>{label}</span>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={styles.fieldSelectButton}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className={styles.fieldSelectValue}>{selectedOption?.label ?? ''}</span>
        <span className={styles.fieldSelectChevron} aria-hidden="true" />
      </button>

      {open ? (
        <div id={listboxId} role="listbox" aria-label={ariaLabel} className={styles.fieldSelectPanel}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.fieldSelectOption} ${selected ? styles.fieldSelectOptionActive : ''}`}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectBoard() {
  const { logout, role, userId } = useAuth();
  const { getProjectGraph, runProjectCommand, undoProjectHistory, redoProjectHistory } = useApiClient();
  const { buildCampaignHref, selectedProjectId, selectionReady } = useCampaignSelection();
  const router = useRouter();
  const normalizedRole = normalizeFrontendRole(role);
  const canToggleMode = canPreviewPlayerMode(normalizedRole);
  const [projectDataById, setProjectDataById] = useState<Record<string, ProjectBoardData>>({});
  const [boardMode, setBoardMode] = useState<BoardMode>(canToggleMode ? 'gm' : 'player');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('now');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedPatternId, setFocusedPatternId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [threadDraft, setThreadDraft] = useState<ThreadDraft | null>(null);
  const [patternDraft, setPatternDraft] = useState<PatternDraft | null>(null);
  const [nowDraft, setNowDraft] = useState<NowDraft | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);
  const [draggingStagedNoteId, setDraggingStagedNoteId] = useState<string | null>(null);
  const nodeContextMenuRef = useRef<HTMLDivElement | null>(null);
  const canShareNotes = normalizedRole === 'gm' || normalizedRole === 'helper' || normalizedRole === 'player';
  const canEditNotes = normalizedRole === 'gm';

  useEffect(() => {
    startTransition(() => {
      setBoardMode(canToggleMode ? 'gm' : 'player');
      if (!canToggleMode) {
        setFocusedPatternId(null);
      }
    });
  }, [canToggleMode]);

  useEffect(() => {
    if (!selectionReady) {
      setLoading(true);
      return;
    }

    if (!selectedProjectId) {
      setLoading(false);
    }
  }, [selectedProjectId, selectionReady]);

  useEffect(() => {
    if (!selectionReady || !selectedProjectId || projectDataById[selectedProjectId]) {
      return;
    }

    let active = true;

    setLoading(true);
    setLoadError('');

    getProjectGraph(selectedProjectId, normalizedRole === 'player' ? 'player' : 'gm')
      .then((graphResponse) => {
        if (!active) {
          return;
        }

        setProjectDataById((currentProjects) => ({
          ...currentProjects,
          [selectedProjectId]: toProjectBoardData(graphResponse),
        }));
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setLoadError(error.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [getProjectGraph, normalizedRole, projectDataById, selectedProjectId, selectionReady]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    startTransition(() => {
      setBoardMode(canToggleMode ? 'gm' : 'player');
      setSelectedNodeId('now');
      setHoveredNodeId(null);
      setFocusedPatternId(null);
      setInspectedPlayerId(null);
      setMenuOpen(false);
      setNodeContextMenu(null);
      setDraggingStagedNoteId(null);
    });
  }, [canToggleMode, selectedProjectId]);

  const currentProject = useMemo(() => (selectedProjectId ? projectDataById[selectedProjectId] ?? null : null), [projectDataById, selectedProjectId]);
  const resolvedProject = currentProject ?? EMPTY_PROJECT_BOARD_DATA;
  const awaitingProjectLoad = Boolean(selectionReady && selectedProjectId && !currentProject && loadError.length === 0);
  const currentSharing = resolvedProject.sharing ?? EMPTY_PROJECT_BOARD_DATA.sharing!;
  const currentManualLinks = resolvedProject.manualLinks ?? EMPTY_PROJECT_BOARD_DATA.manualLinks!;
  const currentHistory = resolvedProject.history ?? EMPTY_PROJECT_BOARD_DATA.history!;
  const currentRevision = resolvedProject.revision ?? EMPTY_PROJECT_BOARD_DATA.revision!;

  const currentPlayerProfile = useMemo(
    () => resolvedProject.playerProfiles.find((profile) => profile.userId === userId) ?? null,
    [resolvedProject.playerProfiles, userId],
  );
  const inspectedPlayerProfile = useMemo(
    () => resolvedProject.playerProfiles.find((profile) => profile.userId === inspectedPlayerId) ?? null,
    [resolvedProject.playerProfiles, inspectedPlayerId],
  );
  const activePlayerPreviewProfile = normalizedRole === 'player'
    ? currentPlayerProfile
    : boardMode === 'player'
      ? inspectedPlayerProfile ?? resolvedProject.playerProfiles[0] ?? null
      : null;
  const boardCenterNodeId = activePlayerPreviewProfile?.patternId ?? 'now';
  const activeRevealOverrides = useMemo(
    () => ({
      globalNodeIds: currentSharing.globalNodeIds ?? [],
      playerNodeIds:
        activePlayerPreviewProfile
          ? currentSharing.playerNodeIdsByPlayer?.[activePlayerPreviewProfile.userId] ?? []
          : [],
    }),
    [activePlayerPreviewProfile, currentSharing],
  );
  const perspectiveAccess = useMemo(
    () => buildPlayerPerspectiveAccess(resolvedProject, boardMode, activePlayerPreviewProfile, activeRevealOverrides),
    [activePlayerPreviewProfile, activeRevealOverrides, boardMode, resolvedProject],
  );
  const perspectiveProject = useMemo(
    () =>
      scopeProjectBoardDataForPerspective(
        resolvedProject,
        boardMode,
        activePlayerPreviewProfile,
        perspectiveAccess,
      ),
    [activePlayerPreviewProfile, boardMode, perspectiveAccess, resolvedProject],
  );
  const showInaccessibleContext = normalizedRole !== 'player' && boardMode === 'player' && Boolean(activePlayerPreviewProfile);
  const deferredHoveredNodeId = useDeferredValue(hoveredNodeId);
  const graph = useMemo(
    () =>
      buildBoardGraph({
        data: showInaccessibleContext ? resolvedProject : perspectiveProject,
        mode: boardMode,
        selectedNodeId,
        hoveredNodeId: deferredHoveredNodeId,
        focusedPatternId,
        centerNodeId: boardCenterNodeId,
        manualLinks: currentManualLinks,
        derivedData: perspectiveProject,
        perspectiveAccess,
        showInaccessibleContext,
      }),
    [
      boardCenterNodeId,
      boardMode,
      resolvedProject,
      currentManualLinks,
      deferredHoveredNodeId,
      focusedPatternId,
      perspectiveAccess,
      perspectiveProject,
      selectedNodeId,
      showInaccessibleContext,
    ],
  );
  const graphNodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const patternIds = useMemo(() => new Set(resolvedProject.patterns.map((pattern) => pattern.id)), [resolvedProject.patterns]);
  const playerAccessById = useMemo(
    () =>
      Object.fromEntries(
        resolvedProject.playerProfiles.map((profile) => [
          profile.userId,
          buildPlayerPerspectiveAccess(resolvedProject, 'player', profile, {
            globalNodeIds: currentSharing.globalNodeIds ?? [],
            playerNodeIds: currentSharing.playerNodeIdsByPlayer?.[profile.userId] ?? [],
          }),
        ]),
      ),
    [currentSharing, resolvedProject],
  );

  const visibleNodeIds = useMemo(
    () => new Set(graph.nodes.filter((node) => node.visible).map((node) => node.id)),
    [graph.nodes],
  );
  const stagedNotes = useMemo<BoardStagedNote[]>(
    () => [
      ...resolvedProject.threads
        .filter(isStagedThread)
        .map((thread) => ({
          id: thread.id,
          type: 'thread' as const,
          title: thread.title,
          trayAnchor: thread.staging.trayAnchor,
          state: thread.state,
        })),
      ...resolvedProject.patterns
        .filter(isStagedPattern)
        .map((pattern) => ({
          id: pattern.id,
          type: 'pattern' as const,
          title: pattern.title,
          trayAnchor: pattern.staging.trayAnchor,
        })),
    ].sort((left, right) => left.title.localeCompare(right.title)),
    [resolvedProject.patterns, resolvedProject.threads],
  );
  const stagedNotesBySegment = useMemo(
    () =>
      stagedNotes.reduce<Record<'past' | 'now' | 'future', BoardStagedNote[]>>(
        (groups, note) => {
          groups[toTimelineSegmentKey(note.trayAnchor)].push(note);
          return groups;
        },
        { past: [], now: [], future: [] },
      ),
    [stagedNotes],
  );
  const showStagingTray = canEditNotes && boardMode === 'gm';

  useEffect(() => {
    if (!canToggleMode || boardMode !== 'player') {
      return;
    }

    const nextInspectedPlayerId =
      resolvedProject.playerProfiles.find((profile) => profile.userId === inspectedPlayerId)?.userId ??
      resolvedProject.playerProfiles[0]?.userId ??
      null;

    if (nextInspectedPlayerId === inspectedPlayerId) {
      return;
    }

    startTransition(() => {
      setInspectedPlayerId(nextInspectedPlayerId);
    });
  }, [boardMode, canToggleMode, inspectedPlayerId, resolvedProject.playerProfiles]);

  useEffect(() => {
    if (!nodeContextMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!nodeContextMenuRef.current?.contains(event.target as Node)) {
        setNodeContextMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNodeContextMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [nodeContextMenu]);

  useEffect(() => {
    setNodeContextMenu(null);
  }, [selectedProjectId, boardMode, inspectedPlayerId]);

  useEffect(() => {
    if (boardMode !== 'player') {
      return;
    }

    if (normalizedRole !== 'player') {
      startTransition(() => {
        setHoveredNodeId(null);
      });
      return;
    }

    startTransition(() => {
      setSelectedNodeId(boardCenterNodeId);
      setFocusedPatternId(boardCenterNodeId.startsWith('pattern-') ? boardCenterNodeId : null);
      setHoveredNodeId(null);
    });
  }, [boardCenterNodeId, boardMode, normalizedRole, selectedProjectId]);

  const selectedProjectThread = useMemo(
    () => resolvedProject.threads.find((thread) => thread.id === selectedNodeId) ?? null,
    [resolvedProject.threads, selectedNodeId],
  );
  const selectedProjectPattern = useMemo(
    () => resolvedProject.patterns.find((pattern) => pattern.id === selectedNodeId) ?? null,
    [resolvedProject.patterns, selectedNodeId],
  );
  const selectedStagedNote = useMemo<BoardStagedNote | null>(() => {
    if (isStagedThread(selectedProjectThread)) {
      return {
        id: selectedProjectThread.id,
        type: 'thread',
        title: selectedProjectThread.title,
        trayAnchor: selectedProjectThread.staging.trayAnchor,
        state: selectedProjectThread.state,
      };
    }

    if (isStagedPattern(selectedProjectPattern)) {
      return {
        id: selectedProjectPattern.id,
        type: 'pattern',
        title: selectedProjectPattern.title,
        trayAnchor: selectedProjectPattern.staging.trayAnchor,
      };
    }

    return null;
  }, [selectedProjectPattern, selectedProjectThread]);

  useEffect(() => {
    if (selectedStagedNote) {
      return;
    }

    if (!visibleNodeIds.has(selectedNodeId)) {
      startTransition(() => {
        setSelectedNodeId(boardCenterNodeId);
        setFocusedPatternId(boardCenterNodeId.startsWith('pattern-') ? boardCenterNodeId : null);
      });
    }
  }, [boardCenterNodeId, selectedNodeId, selectedStagedNote, visibleNodeIds]);

  const roleVisibleThreads = useMemo(
    () => perspectiveProject.threads,
    [perspectiveProject.threads],
  );
  const roleVisiblePatterns = useMemo(
    () => perspectiveProject.patterns,
    [perspectiveProject.patterns],
  );

  const selectedThread = useMemo(
    () => (boardMode === 'gm' ? selectedProjectThread : roleVisibleThreads.find((thread) => thread.id === selectedNodeId) ?? null),
    [boardMode, roleVisibleThreads, selectedNodeId, selectedProjectThread],
  );
  const selectedPattern = useMemo(
    () =>
      boardMode === 'gm'
        ? selectedProjectPattern
        : roleVisiblePatterns.find((pattern) => pattern.id === selectedNodeId) ?? null,
    [boardMode, roleVisiblePatterns, selectedNodeId, selectedProjectPattern],
  );
  const timelineSummary = useMemo(
    () => summarizeTimelineAnchors(perspectiveProject, 'gm'),
    [perspectiveProject],
  );
  const selectedTimelineKey: 'past' | 'now' | 'future' = selectedStagedNote
    ? toTimelineSegmentKey(selectedStagedNote.trayAnchor)
    : selectedThread
      ? toTimelineSegmentKey(selectedThread.timelineAnchor)
      : 'now';

  useEffect(() => {
    if (!canEditNotes || boardMode !== 'gm' || !selectedThread) {
      setThreadDraft((currentDraft) => (currentDraft === null ? currentDraft : null));
      return;
    }

    const nextDraft = toThreadDraft(selectedThread);
    setThreadDraft((currentDraft) => (areThreadDraftsEqual(currentDraft, nextDraft) ? currentDraft : nextDraft));
  }, [boardMode, canEditNotes, selectedThread]);

  useEffect(() => {
    if (!canEditNotes || boardMode !== 'gm' || !selectedPattern) {
      setPatternDraft((currentDraft) => (currentDraft === null ? currentDraft : null));
      return;
    }

    const nextDraft = toPatternDraft(selectedPattern);
    setPatternDraft((currentDraft) => (arePatternDraftsEqual(currentDraft, nextDraft) ? currentDraft : nextDraft));
  }, [boardMode, canEditNotes, selectedPattern]);

  useEffect(() => {
    if (!canEditNotes || boardMode !== 'gm' || selectedThread || selectedPattern) {
      setNowDraft((currentDraft) => (currentDraft === null ? currentDraft : null));
      return;
    }

    const nextDraft = toNowDraft(resolvedProject.now);
    setNowDraft((currentDraft) => (areNowDraftsEqual(currentDraft, nextDraft) ? currentDraft : nextDraft));
  }, [boardMode, canEditNotes, resolvedProject.now, selectedPattern, selectedThread]);

  useEffect(() => {
    if (!selectedThread || !threadDraft || !canEditNotes || boardMode !== 'gm') {
      return;
    }

    const sourceDraft = toThreadDraft(selectedThread);
    if (JSON.stringify(sourceDraft) === JSON.stringify(threadDraft)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleBoardCommand({
        kind: 'update_thread',
        threadId: selectedThread.id,
        title: threadDraft.title,
        hook: threadDraft.hook || null,
        playerSummary: threadDraft.playerSummary,
        gmTruth: threadDraft.gmTruth || null,
        state: threadDraft.state,
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardMode, canEditNotes, selectedThread, threadDraft]);

  useEffect(() => {
    if (!selectedPattern || !patternDraft || !canEditNotes || boardMode !== 'gm') {
      return;
    }

    const sourceDraft = toPatternDraft(selectedPattern);
    if (JSON.stringify(sourceDraft) === JSON.stringify(patternDraft)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleBoardCommand({
        kind: 'update_pattern',
        patternId: selectedPattern.id,
        title: patternDraft.title,
        summary: patternDraft.summary,
        escalationLevel: patternDraft.escalationLevel,
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardMode, canEditNotes, patternDraft, selectedPattern]);

  useEffect(() => {
    if (!nowDraft || !canEditNotes || boardMode !== 'gm' || selectedThread || selectedPattern) {
      return;
    }

    const sourceDraft = toNowDraft(resolvedProject.now);
    if (JSON.stringify(sourceDraft) === JSON.stringify(nowDraft)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleBoardCommand({
        kind: 'update_now',
        title: nowDraft.title,
        playerSummary: nowDraft.playerSummary,
        gmTruth: nowDraft.gmTruth || null,
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardMode, canEditNotes, nowDraft, resolvedProject.now, selectedPattern, selectedThread]);

  const viewerLabel =
    boardMode === 'gm'
      ? getRoleLabel(normalizedRole)
      : canToggleMode
        ? activePlayerPreviewProfile
          ? `Player Preview: ${activePlayerPreviewProfile.displayName}`
          : 'Player Preview'
        : currentPlayerProfile
          ? `Player: ${currentPlayerProfile.displayName}`
          : 'Player';
  const perspectiveOptions = useMemo<TopBarSelectOption[]>(
    () => [
      { value: 'gm', label: 'GM View' },
      ...resolvedProject.playerProfiles.map((profile) => ({
        value: profile.userId,
        label: profile.displayName,
      })),
    ],
    [resolvedProject.playerProfiles],
  );

  function applyGraphUpdate(updatedProject: ProjectBoardData) {
    setProjectDataById((currentProjects) => ({
      ...currentProjects,
      [updatedProject.project.id]: updatedProject,
    }));
  }

  async function handleBoardCommand(command: Parameters<typeof runProjectCommand>[1]) {
    if (!selectedProjectId) {
      return null;
    }

    setSaveState('saving');
    setSaveMessage('');

    try {
      const result = await runProjectCommand(selectedProjectId, command);
      const updatedProject = toProjectBoardData(result.graph);
      applyGraphUpdate(updatedProject);
      setSaveState('saved');
      setSaveMessage(result.revision.summary);
      return updatedProject;
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save change.');
      return null;
    }
  }

  function handlePerspectiveSelect(nextPerspective: string) {
    if (nextPerspective === 'gm') {
      startTransition(() => {
        setBoardMode('gm');
        setInspectedPlayerId(null);
        setSelectedNodeId('now');
        setFocusedPatternId(null);
        setHoveredNodeId(null);
        setDraggingStagedNoteId(null);
      });
      return;
    }

    const selectedProfile = resolvedProject.playerProfiles.find((profile) => profile.userId === nextPerspective);
    const selectedThreadForPerspective = resolvedProject.threads.find(
      (thread) => thread.id === selectedNodeId && thread.playerVisible,
    );
    const nextSelectedNodeId = selectedThreadForPerspective?.id ?? selectedProfile?.patternId ?? 'now';
    const nextFocusedPatternId =
      selectedThreadForPerspective?.patternId ?? selectedProfile?.patternId ?? null;

    startTransition(() => {
      setBoardMode('player');
      setInspectedPlayerId(nextPerspective);
      setSelectedNodeId(nextSelectedNodeId);
      setFocusedPatternId(nextFocusedPatternId);
      setHoveredNodeId(null);
      setDraggingStagedNoteId(null);
    });
  }

  async function handleCreateStagedThread(input: StagedNoteCreationInput) {
    const existingThreadIds = new Set(resolvedProject.threads.map((thread) => thread.id));
    const updatedProject = await handleBoardCommand({
      kind: 'create_thread',
      title: input.title,
      trayAnchor: input.trayAnchor,
      hook: null,
      playerSummary: '',
      gmTruth: null,
    });

    const createdThread = updatedProject?.threads.find(
      (thread) => !existingThreadIds.has(thread.id) && isStagedThread(thread),
    );

    if (!createdThread) {
      return false;
    }

    startTransition(() => {
      setSelectedNodeId(createdThread.id);
      setFocusedPatternId(null);
      setHoveredNodeId(null);
      setDraggingStagedNoteId(null);
    });

    return true;
  }

  async function handleCreateStagedPattern(input: StagedNoteCreationInput) {
    const existingPatternIds = new Set(resolvedProject.patterns.map((pattern) => pattern.id));
    const updatedProject = await handleBoardCommand({
      kind: 'create_pattern',
      title: input.title,
      trayAnchor: input.trayAnchor,
      summary: '',
      escalationLevel: 1,
    });

    const createdPattern = updatedProject?.patterns.find(
      (pattern) => !existingPatternIds.has(pattern.id) && isStagedPattern(pattern),
    );

    if (!createdPattern) {
      return false;
    }

    startTransition(() => {
      setSelectedNodeId(createdPattern.id);
      setFocusedPatternId(null);
      setHoveredNodeId(null);
      setDraggingStagedNoteId(null);
    });

    return true;
  }

  async function handleActivateStagedNote(noteId: string, targetNodeId: string) {
    const updatedProject = await handleBoardCommand({
      kind: 'activate_staged_note',
      noteId,
      targetNodeId,
    });

    if (!updatedProject) {
      return false;
    }

    const activatedThread = updatedProject.threads.find((thread) => thread.id === noteId) ?? null;
    const activatedPattern = updatedProject.patterns.find((pattern) => pattern.id === noteId) ?? null;

    startTransition(() => {
      setSelectedNodeId(noteId);
      setFocusedPatternId(activatedThread?.patternId ?? activatedPattern?.id ?? null);
      setHoveredNodeId(null);
      setDraggingStagedNoteId(null);
    });

    return true;
  }

  async function handleCreateManualLink(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    const nextManualLink = createManualLink(sourceId, targetId);
    const canonicalPairExists = graph.canonicalEdges.some(
      (edge) =>
        (edge.source === nextManualLink.sourceId && edge.target === nextManualLink.targetId) ||
        (edge.source === nextManualLink.targetId && edge.target === nextManualLink.sourceId),
    );

    if (canonicalPairExists) {
      return;
    }

    await handleBoardCommand({
      kind: 'create_manual_link',
      sourceId,
      targetId,
    });

    startTransition(() => {
      setSelectedNodeId(targetId);
      setFocusedPatternId(targetId.startsWith('pattern-') ? targetId : null);
      setHoveredNodeId(null);
      setNodeContextMenu(null);
      setDraggingStagedNoteId(null);
    });
  }

  async function handleShareNodeToPlayer(nodeId: string, targetPlayerId: string) {
    await handleBoardCommand({
      kind: 'share_node_to_player',
      nodeId,
      playerUserId: targetPlayerId,
    });

    startTransition(() => {
      setNodeContextMenu(null);
    });
  }

  async function handleShareNodeToAll(nodeId: string) {
    await handleBoardCommand({
      kind: 'share_node_to_all',
      nodeId,
    });

    startTransition(() => {
      setNodeContextMenu(null);
    });
  }

  async function handleUndo() {
    if (!selectedProjectId || !canEditNotes || !currentHistory.canUndo) {
      return;
    }

    setSaveState('saving');
    setSaveMessage('');

    try {
      const result = await undoProjectHistory(selectedProjectId);
      applyGraphUpdate(toProjectBoardData(result.graph));
      setSaveState('saved');
      setSaveMessage(result.revision?.summary ?? 'Undid last change.');
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : 'Unable to undo.');
    }
  }

  async function handleRedo() {
    if (!selectedProjectId || !canEditNotes || !currentHistory.canRedo) {
      return;
    }

    setSaveState('saving');
    setSaveMessage('');

    try {
      const result = await redoProjectHistory(selectedProjectId);
      applyGraphUpdate(toProjectBoardData(result.graph));
      setSaveState('saved');
      setSaveMessage(result.revision?.summary ?? 'Redid last change.');
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : 'Unable to redo.');
    }
  }

  function handleEditNodeFromContextMenu(nodeId: string) {
    if (!canEditNotes) {
      return;
    }

    const thread = resolvedProject.threads.find((entry) => entry.id === nodeId);
    const pattern = resolvedProject.patterns.find((entry) => entry.id === nodeId);

    startTransition(() => {
      setBoardMode('gm');
      setInspectedPlayerId(null);
      setSelectedNodeId(nodeId);
      setFocusedPatternId(thread?.patternId ?? pattern?.id ?? null);
      setHoveredNodeId(null);
      setNodeContextMenu(null);
      setDraggingStagedNoteId(null);
    });
  }

  function handleSelectStagedNote(noteId: string) {
    const thread = resolvedProject.threads.find((entry) => entry.id === noteId) ?? null;
    const pattern = resolvedProject.patterns.find((entry) => entry.id === noteId) ?? null;

    startTransition(() => {
      setSelectedNodeId(noteId);
      setFocusedPatternId(thread?.patternId ?? pattern?.id ?? null);
      setHoveredNodeId(null);
      setNodeContextMenu(null);
    });
  }

  function isNodeSharedWithPlayer(nodeId: string, targetPlayerId: string) {
    const access = playerAccessById[targetPlayerId];

    if (!access) {
      return false;
    }

    return patternIds.has(nodeId)
      ? access.accessiblePatternIds.has(nodeId)
      : access.accessibleThreadIds.has(nodeId);
  }

  const contextMenuNode = nodeContextMenu ? graphNodesById.get(nodeContextMenu.nodeId) ?? null : null;
  const nodeSharedWithAllPlayers =
    nodeContextMenu && resolvedProject.playerProfiles.length > 0
      ? resolvedProject.playerProfiles.every((profile) => isNodeSharedWithPlayer(nodeContextMenu.nodeId, profile.userId))
      : false;

  function handleLogout() {
    startTransition(() => {
      setMenuOpen(false);
      logout();
      router.push('/login');
    });
  }

  if ((!selectionReady || loading || awaitingProjectLoad) && !currentProject) {
    return (
      <div className={styles.boardPage} data-testid="project-board">
        <div className={styles.boardLoading}>Loading campaign board...</div>
      </div>
    );
  }

  if (loadError && !currentProject) {
    return (
      <div className={styles.boardPage} data-testid="project-board">
        <div className={styles.boardLoading}>{loadError}</div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className={styles.boardPage} data-testid="project-board">
        <div className={styles.boardLoading}>No campaign available.</div>
      </div>
    );
  }

  return (
    <div className={styles.boardPage} data-testid="project-board">
      <header className={styles.boardTopBar}>
        <div className={styles.topBarBrand}>
          <div>
            <span className={styles.brandEyebrow}>Project Board</span>
            <h1 className={styles.brandTitle}>{resolvedProject.project.name}</h1>
            <p className={styles.brandMeta}>{`Viewing as ${viewerLabel}`}</p>
          </div>
        </div>

        <div className={styles.topBarControls}>
          {canToggleMode ? (
            <div className={styles.fieldCluster}>
              <TopBarSelect
                label="Perspective"
                ariaLabel="Perspective"
                value={boardMode === 'gm' ? 'gm' : inspectedPlayerId ?? resolvedProject.playerProfiles[0]?.userId ?? 'gm'}
                options={perspectiveOptions}
                onSelect={handlePerspectiveSelect}
              />
            </div>
          ) : (
            <div className={styles.lockedMode}>Player View</div>
          )}

          <label className={styles.zoomControl}>
            <span className={styles.fieldLabel}>Zoom</span>
            <input
              aria-label="Board zoom"
              className={styles.zoomSlider}
              type="range"
              min="70"
              max="170"
              step="5"
              value={zoomPercent}
              onChange={(event) => setZoomPercent(Number(event.target.value))}
            />
            <span className={styles.zoomValue}>{`${zoomPercent}%`}</span>
          </label>

          {canEditNotes ? (
            <div className={styles.historyControls}>
              <button type="button" className={styles.historyButton} onClick={handleUndo} disabled={!currentHistory.canUndo}>
                Undo
              </button>
              <button type="button" className={styles.historyButton} onClick={handleRedo} disabled={!currentHistory.canRedo}>
                Redo
              </button>
            </div>
          ) : null}

          <div className={styles.menuWrapper}>
            <button
              type="button"
              className={styles.menuButton}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              Menu
            </button>
            {menuOpen ? (
              <div className={styles.menuPanel} role="menu">
                <Link href="/threads" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Open Threads
                </Link>
                <Link href={buildCampaignHref('/timeline')} role="menuitem" onClick={() => setMenuOpen(false)}>
                  Open Timeline
                </Link>
                {canViewGmContent(normalizedRole) ? (
                  <Link
                    href={buildCampaignHref('/player-characters')}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open Characters
                  </Link>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.logoutMenuItem}
                  onClick={handleLogout}
                >
                  <span className={styles.logoutMenuBullet} aria-hidden="true" />
                  <span>Log out</span>
                </button>
                <p className={styles.menuMeta}>{`Signed in as ${getRoleLabel(normalizedRole)}`}</p>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {loadError ? <div className={styles.boardStatusBar}>{loadError}</div> : null}
      {saveState !== 'idle' || saveMessage ? (
        <div className={styles.boardStatusBar} data-save-state={saveState}>
          {saveState === 'saving' ? 'Saving changes...' : saveMessage || currentRevision?.summary || ''}
        </div>
      ) : null}

      <section className={styles.boardStage}>
        <div className={styles.boardMain}>
          <div className={styles.canvasShell}>
            <StoryGraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              centerNodeId={boardCenterNodeId}
              zoom={zoomPercent / 100}
              backgroundSelectNodeId={boardCenterNodeId}
              stagedDragNodeId={showStagingTray ? draggingStagedNoteId : null}
              onHoverNode={(nodeId) => {
                setHoveredNodeId(nodeId);
              }}
              onCreateLink={canEditNotes ? handleCreateManualLink : undefined}
              onDropStagedNote={showStagingTray ? handleActivateStagedNote : undefined}
              onContextMenuNode={(nodeId, clientX, clientY) => {
                if (!canShareNotes) {
                  setNodeContextMenu(null);
                  return;
                }

                setNodeContextMenu({
                  nodeId,
                  clientX,
                  clientY,
                });
              }}
              onSelectNode={(nodeId) => {
                startTransition(() => {
                  setNodeContextMenu(null);
                  setSelectedNodeId(nodeId);
                  if (nodeId === boardCenterNodeId && boardCenterNodeId.startsWith('pattern-')) {
                    setFocusedPatternId(boardCenterNodeId);
                  } else if (nodeId === 'now') {
                    setFocusedPatternId(null);
                  }
                });
              }}
            />
          </div>

          <div className={styles.inspectorShell}>
            <FocusCard
              projectName={resolvedProject.project.name}
              nowSummary={resolvedProject.now}
              boardMode={boardMode}
              viewerRole={normalizedRole}
              canEdit={canEditNotes && boardMode === 'gm'}
              saveState={saveState}
              saveMessage={saveMessage}
              selectedThread={selectedThread}
              selectedPattern={selectedPattern}
              linkedThreads={boardMode === 'gm' ? resolvedProject.threads : roleVisibleThreads}
              linkedEntities={boardMode === 'gm' ? resolvedProject.linkedEntities : perspectiveProject.linkedEntities}
              derivedEdges={graph.derivedEdges}
              threadDraft={threadDraft}
              patternDraft={patternDraft}
              nowDraft={nowDraft}
              onChangeThreadDraft={setThreadDraft}
              onChangePatternDraft={setPatternDraft}
              onChangeNowDraft={setNowDraft}
              visibleThreadCount={
                graph.nodes.filter(
                  (node) => node.type === 'thread' && node.visible && node.accessibleInPerspective,
                ).length
              }
              visiblePatternCount={
                graph.nodes.filter(
                  (node) => node.type === 'pattern' && node.visible && node.accessibleInPerspective,
                ).length
              }
              showStagingActions={showStagingTray}
              onCreateStagedThread={handleCreateStagedThread}
              onCreateStagedPattern={handleCreateStagedPattern}
              focusedPatternId={focusedPatternId}
              onReset={() => {
                startTransition(() => {
                  setSelectedNodeId(boardCenterNodeId);
                  setFocusedPatternId(boardCenterNodeId.startsWith('pattern-') ? boardCenterNodeId : null);
                });
              }}
              onFocusPattern={(patternId) => {
                startTransition(() => {
                  setSelectedNodeId(patternId);
                  setFocusedPatternId(patternId);
                });
              }}
            />
          </div>
        </div>

        {nodeContextMenu && canShareNotes ? (
          <div
            ref={nodeContextMenuRef}
            className={styles.contextMenuPanel}
            role="menu"
            style={{
              left: nodeContextMenu.clientX,
              top: nodeContextMenu.clientY,
            }}
          >
            {contextMenuNode ? (
              <p className={styles.contextMenuTitle}>{contextMenuNode.label}</p>
            ) : null}

            {resolvedProject.playerProfiles.map((profile) => {
              const alreadyShared = isNodeSharedWithPlayer(nodeContextMenu.nodeId, profile.userId);

              return (
                <button
                  key={`${nodeContextMenu.nodeId}-${profile.userId}`}
                  type="button"
                  role="menuitem"
                  className={`${styles.contextMenuItem} ${alreadyShared ? styles.contextMenuItemDisabled : ''}`}
                  disabled={alreadyShared}
                  onClick={() => handleShareNodeToPlayer(nodeContextMenu.nodeId, profile.userId)}
                >
                  <span className={styles.contextMenuBullet} aria-hidden="true" />
                  <span>{alreadyShared ? `Shared with ${profile.displayName}` : `Share with ${profile.displayName}`}</span>
                </button>
              );
            })}

            {resolvedProject.playerProfiles.length > 0 ? (
              <button
                type="button"
                role="menuitem"
                className={`${styles.contextMenuItem} ${nodeSharedWithAllPlayers ? styles.contextMenuItemDisabled : ''}`}
                disabled={nodeSharedWithAllPlayers}
                onClick={() => handleShareNodeToAll(nodeContextMenu.nodeId)}
              >
                <span className={styles.contextMenuBullet} aria-hidden="true" />
                <span>{nodeSharedWithAllPlayers ? 'Shared with all players' : 'Share with all players'}</span>
              </button>
            ) : null}

            {canEditNotes ? (
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => handleEditNodeFromContextMenu(nodeContextMenu.nodeId)}
              >
                <span className={styles.contextMenuBullet} aria-hidden="true" />
                <span>Edit</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.timelineSection}>
        <TimelineBar
          summary={timelineSummary}
          selectedKey={selectedTimelineKey}
          showStagingTray={showStagingTray}
          stagedNotesBySegment={stagedNotesBySegment}
          selectedNoteId={selectedNodeId}
          draggingNoteId={draggingStagedNoteId}
          onSelectStagedNote={handleSelectStagedNote}
          onStartStagedDrag={setDraggingStagedNoteId}
          onEndStagedDrag={() => setDraggingStagedNoteId(null)}
        />
      </section>
    </div>
  );
}

type FocusCardProps = {
  projectName: string;
  nowSummary: {
    title: string;
    playerSummary: string;
    gmTruth?: string;
  };
  boardMode: BoardMode;
  viewerRole: string;
  canEdit: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage: string;
  selectedThread: BoardThread | null;
  selectedPattern: BoardPattern | null;
  linkedThreads: BoardThread[];
  linkedEntities: Record<string, { id: string; name: string; playerVisible: boolean }>;
  derivedEdges: DerivedThreatEdge[];
  threadDraft: ThreadDraft | null;
  patternDraft: PatternDraft | null;
  nowDraft: NowDraft | null;
  onChangeThreadDraft: React.Dispatch<React.SetStateAction<ThreadDraft | null>>;
  onChangePatternDraft: React.Dispatch<React.SetStateAction<PatternDraft | null>>;
  onChangeNowDraft: React.Dispatch<React.SetStateAction<NowDraft | null>>;
  visibleThreadCount: number;
  visiblePatternCount: number;
  showStagingActions: boolean;
  onCreateStagedThread: (input: StagedNoteCreationInput) => Promise<boolean>;
  onCreateStagedPattern: (input: StagedNoteCreationInput) => Promise<boolean>;
  focusedPatternId: string | null;
  onReset: () => void;
  onFocusPattern: (patternId: string) => void;
};

function FocusCard({
  projectName,
  nowSummary,
  boardMode,
  viewerRole,
  canEdit,
  saveState,
  saveMessage,
  selectedThread,
  selectedPattern,
  linkedThreads,
  linkedEntities,
  derivedEdges,
  threadDraft,
  patternDraft,
  nowDraft,
  onChangeThreadDraft,
  onChangePatternDraft,
  onChangeNowDraft,
  visibleThreadCount,
  visiblePatternCount,
  showStagingActions,
  onCreateStagedThread,
  onCreateStagedPattern,
  focusedPatternId,
  onReset,
  onFocusPattern,
}: FocusCardProps) {
  const showGmTruth = boardMode === 'gm' && canViewGmContent(viewerRole);
  const linkedThreadsById = new Map(linkedThreads.map((thread) => [thread.id, thread]));
  const [composerKind, setComposerKind] = useState<'thread' | 'pattern' | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadAnchor, setNewThreadAnchor] = useState<BoardTimelineAnchor>('now');
  const [newPatternTitle, setNewPatternTitle] = useState('');
  const [newPatternAnchor, setNewPatternAnchor] = useState<BoardTimelineAnchor>('now');

  useEffect(() => {
    if (selectedThread || selectedPattern || !showStagingActions) {
      setComposerKind(null);
    }
  }, [selectedPattern, selectedThread, showStagingActions]);

  if (selectedThread) {
    const linkedEntityNames = selectedThread.linkedEntityIds
      .map((entityId) => linkedEntities[entityId])
      .filter((entity) => entity && (boardMode === 'gm' || entity.playerVisible));
    const stateMeta = THREAD_STATE_META[selectedThread.state];
    const relatedThreats = derivedEdges
      .filter((edge) => edge.sourceId === selectedThread.id || edge.targetId === selectedThread.id)
      .map((edge) => {
        const relatedThreadId = edge.sourceId === selectedThread.id ? edge.targetId : edge.sourceId;
        const relatedThread = linkedThreadsById.get(relatedThreadId);

        if (!relatedThread) {
          return null;
        }

        return {
          relatedThread,
          strength: edge.strength,
          tier: edge.tier,
          reasons: edge.reasons,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(
        (left, right) =>
          right.strength - left.strength || left.relatedThread.title.localeCompare(right.relatedThread.title),
      )
      .slice(0, 3);

    return (
      <aside className={styles.focusCard} data-testid="focus-card">
        <div className={styles.focusCardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Thread</p>
            {canEdit && threadDraft ? (
              <input
                className={styles.editorTitleInput}
                value={threadDraft.title}
                onChange={(event) =>
                  onChangeThreadDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          title: event.target.value,
                        }
                      : currentDraft,
                  )
                }
              />
            ) : (
              <h2>{selectedThread.title}</h2>
            )}
            {saveState !== 'idle' || saveMessage ? (
              <p className={styles.saveIndicator}>{saveState === 'saving' ? 'Saving...' : saveMessage}</p>
            ) : null}
          </div>
          <button type="button" className={`${styles.ghostButton} ${styles.closeButton}`} onClick={onReset}>
            x
          </button>
        </div>

        <div className={styles.cardMetaRow}>
          <div className={styles.cardMetaPill}>
            <span>State</span>
            {canEdit && threadDraft ? (
              <select
                className={styles.editorSelect}
                value={threadDraft.state}
                onChange={(event) =>
                  onChangeThreadDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          state: event.target.value as BoardThread['state'],
                        }
                      : currentDraft,
                  )
                }
              >
                <option value="dormant">Dormant</option>
                <option value="active">Active</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            ) : (
              <strong>{stateMeta.label}</strong>
            )}
          </div>
          <div className={styles.cardMetaPill}>
            <span>Timeline</span>
            <strong>{getBoardTimelineLabel(selectedThread.timelineAnchor)}</strong>
          </div>
          {isStagedThread(selectedThread) ? (
            <div className={styles.cardMetaPill}>
              <span>Staged</span>
              <strong>{getBoardTimelineLabel(selectedThread.staging.trayAnchor)}</strong>
            </div>
          ) : null}
        </div>

        {selectedThread.hook || canEdit ? (
          <div className={styles.cardSection}>
            <h3>Hook</h3>
            {canEdit && threadDraft ? (
              <textarea
                className={styles.editorTextarea}
                value={threadDraft.hook}
                onChange={(event) =>
                  onChangeThreadDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          hook: event.target.value,
                        }
                      : currentDraft,
                  )
                }
              />
            ) : (
              <p>{selectedThread.hook}</p>
            )}
          </div>
        ) : null}

        <div className={styles.cardDivider} />

        <div className={styles.cardSection}>
          <h3>Players See</h3>
          {canEdit && threadDraft ? (
            <textarea
              className={styles.editorTextarea}
              value={threadDraft.playerSummary}
              onChange={(event) =>
                onChangeThreadDraft((currentDraft) =>
                  currentDraft
                    ? {
                        ...currentDraft,
                        playerSummary: event.target.value,
                      }
                    : currentDraft,
                )
              }
            />
          ) : (
            <p>{selectedThread.playerSummary}</p>
          )}
        </div>

        {showGmTruth && (selectedThread.gmTruth || canEdit) ? (
          <div className={styles.cardSection}>
            <h3>GM Truth</h3>
            {canEdit && threadDraft ? (
              <textarea
                className={styles.editorTextarea}
                value={threadDraft.gmTruth}
                onChange={(event) =>
                  onChangeThreadDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          gmTruth: event.target.value,
                        }
                      : currentDraft,
                  )
                }
              />
            ) : (
              <p>{selectedThread.gmTruth}</p>
            )}
          </div>
        ) : null}

        <div className={styles.cardSection}>
          <h3>Linked Entities</h3>
          <ul className={styles.entityList}>
            {linkedEntityNames.map((entity) => (
              <li key={entity.id} className={styles.entityChip}>
                {entity.name}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.cardSection}>
          <h3>Related Threats</h3>
          {relatedThreats.length > 0 ? (
            <ul className={styles.relatedThreatList} data-testid="related-threats">
              {relatedThreats.map(({ relatedThread, strength, tier, reasons }) => (
                <li
                  key={relatedThread.id}
                  className={styles.relatedThreatItem}
                  data-testid={`related-threat-${relatedThread.id}`}
                >
                  <div className={styles.relatedThreatHeader}>
                    <strong className={styles.relatedThreatTitle}>{relatedThread.title}</strong>
                    <span
                      className={`${styles.relationshipPill} ${
                        tier === 'strong'
                          ? styles.relationshipPillStrong
                          : tier === 'medium'
                            ? styles.relationshipPillMedium
                            : styles.relationshipPillWeak
                      }`}
                    >
                      {`${CONNECTION_TIER_LABELS[tier]} ${formatConnectionStrength(strength)}`}
                    </span>
                  </div>
                  <ul className={styles.reasonList}>
                    {reasons.map((reason) => (
                      <li key={`${relatedThread.id}-${reason.kind}-${reason.label}`}>{reason.label}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.relationshipEmpty}>No significant related threats in this view.</p>
          )}
        </div>

        <div className={styles.actionRow}>
          <Link href={`/threads/${selectedThread.id}`} className={styles.cardButton}>
            Open Thread
          </Link>
          {selectedThread.patternId ? (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => onFocusPattern(selectedThread.patternId!)}
            >
              Focus Cluster
            </button>
          ) : null}
        </div>
      </aside>
    );
  }

  if (selectedPattern) {
    const childThreads = linkedThreads.filter((thread) => thread.patternId === selectedPattern.id);

    return (
      <aside className={styles.focusCard} data-testid="focus-card">
        <div className={styles.focusCardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Pattern</p>
            {canEdit && patternDraft ? (
              <input
                className={styles.editorTitleInput}
                value={patternDraft.title}
                onChange={(event) =>
                  onChangePatternDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          title: event.target.value,
                        }
                      : currentDraft,
                  )
                }
              />
            ) : (
              <h2>{selectedPattern.title}</h2>
            )}
            {saveState !== 'idle' || saveMessage ? (
              <p className={styles.saveIndicator}>{saveState === 'saving' ? 'Saving...' : saveMessage}</p>
            ) : null}
          </div>
          <button type="button" className={`${styles.ghostButton} ${styles.closeButton}`} onClick={onReset}>
            x
          </button>
        </div>

        <div className={styles.cardMetaRow}>
          <div className={styles.cardMetaPill}>
            <span>Escalation</span>
            {canEdit && patternDraft ? (
              <select
                className={styles.editorSelect}
                value={String(patternDraft.escalationLevel)}
                onChange={(event) =>
                  onChangePatternDraft((currentDraft) =>
                    currentDraft
                      ? {
                          ...currentDraft,
                          escalationLevel: Number(event.target.value),
                        }
                      : currentDraft,
                  )
                }
              >
                <option value="1">1/3</option>
                <option value="2">2/3</option>
                <option value="3">3/3</option>
              </select>
            ) : (
              <strong>{selectedPattern.escalationLevel}/3</strong>
            )}
          </div>
          <div className={styles.cardMetaPill}>
            <span>Threads</span>
            <strong>{childThreads.length}</strong>
          </div>
          {isStagedPattern(selectedPattern) ? (
            <div className={styles.cardMetaPill}>
              <span>Staged</span>
              <strong>{getBoardTimelineLabel(selectedPattern.staging.trayAnchor)}</strong>
            </div>
          ) : null}
        </div>

        <div className={styles.cardDivider} />

        <div className={styles.cardSection}>
          <h3>Summary</h3>
          {canEdit && patternDraft ? (
            <textarea
              className={styles.editorTextarea}
              value={patternDraft.summary}
              onChange={(event) =>
                onChangePatternDraft((currentDraft) =>
                  currentDraft
                    ? {
                        ...currentDraft,
                        summary: event.target.value,
                      }
                    : currentDraft,
                )
              }
            />
          ) : (
            <p>{selectedPattern.summary}</p>
          )}
        </div>

        <div className={styles.cardSection}>
          <h3>Child Threads</h3>
          <ul className={styles.threadList}>
            {childThreads.map((thread) => (
              <li key={thread.id} className={styles.threadChip}>
                {thread.title}
              </li>
            ))}
          </ul>
        </div>

        {!isStagedPattern(selectedPattern) ? (
          <div className={styles.actionRow}>
            <button type="button" className={styles.cardButton} onClick={() => onFocusPattern(selectedPattern.id)}>
              {focusedPatternId === selectedPattern.id ? 'Cluster Focused' : 'Focus Cluster'}
            </button>
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className={styles.focusCard} data-testid="focus-card">
      <div className={styles.focusCardHeader}>
        <div>
          <p className={styles.cardEyebrow}>Now</p>
          {canEdit && nowDraft ? (
            <input
              className={styles.editorTitleInput}
              value={nowDraft.title}
              onChange={(event) =>
                onChangeNowDraft((currentDraft) =>
                  currentDraft
                    ? {
                        ...currentDraft,
                        title: event.target.value,
                      }
                    : currentDraft,
                )
              }
            />
          ) : (
            <h2>{nowSummary.title}</h2>
          )}
          {saveState !== 'idle' || saveMessage ? (
            <p className={styles.saveIndicator}>{saveState === 'saving' ? 'Saving...' : saveMessage}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.cardMetaRow}>
        <div className={styles.cardMetaPill}>
          <span>Visible Threads</span>
          <strong>{visibleThreadCount}</strong>
        </div>
        <div className={styles.cardMetaPill}>
          <span>Visible Patterns</span>
          <strong>{visiblePatternCount}</strong>
        </div>
      </div>

      <div className={styles.cardDivider} />

      <div className={styles.cardSection}>
        <h3>Current Pressure</h3>
        {canEdit && nowDraft ? (
          <textarea
            className={styles.editorTextarea}
            value={nowDraft.playerSummary}
            onChange={(event) =>
              onChangeNowDraft((currentDraft) =>
                currentDraft
                  ? {
                      ...currentDraft,
                      playerSummary: event.target.value,
                    }
                  : currentDraft,
              )
            }
          />
        ) : (
          <p>{nowSummary.playerSummary}</p>
        )}
      </div>

      {showGmTruth && (nowSummary.gmTruth || canEdit) ? (
        <div className={styles.cardSection}>
          <h3>GM Truth</h3>
          {canEdit && nowDraft ? (
            <textarea
              className={styles.editorTextarea}
              value={nowDraft.gmTruth}
              onChange={(event) =>
                onChangeNowDraft((currentDraft) =>
                  currentDraft
                    ? {
                        ...currentDraft,
                        gmTruth: event.target.value,
                      }
                    : currentDraft,
                )
              }
            />
          ) : (
            <p>{nowSummary.gmTruth}</p>
          )}
        </div>
      ) : null}

      <div className={styles.cardSection}>
        <h3>Why This View Matters</h3>
        <p>{`${projectName} currently shows the story pressures closest to NOW so you can see what needs attention first.`}</p>
      </div>

      {showStagingActions ? (
        <div className={styles.cardSection}>
          <h3>Stage New Note</h3>
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.cardButton}
              data-testid="new-thread-button"
              onClick={() => setComposerKind('thread')}
            >
              New Thread
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              data-testid="new-pattern-button"
              onClick={() => setComposerKind('pattern')}
            >
              New Pattern
            </button>
          </div>

          {composerKind === 'thread' ? (
            <form
              className={styles.stagedComposer}
              onSubmit={async (event) => {
                event.preventDefault();
                const didCreate = await onCreateStagedThread({
                  title: newThreadTitle,
                  trayAnchor: newThreadAnchor,
                });

                if (!didCreate) {
                  return;
                }

                setNewThreadTitle('');
                setNewThreadAnchor('now');
                setComposerKind(null);
              }}
            >
              <input
                className={styles.editorInput}
                data-testid="new-thread-title-input"
                placeholder="Thread title"
                value={newThreadTitle}
                onChange={(event) => setNewThreadTitle(event.target.value)}
              />
              <select
                className={styles.editorSelect}
                data-testid="new-thread-anchor-select"
                value={newThreadAnchor}
                onChange={(event) => setNewThreadAnchor(event.target.value as BoardTimelineAnchor)}
              >
                <option value="past">Past tray</option>
                <option value="now">Now tray</option>
                <option value="future_possible">Future tray</option>
              </select>
              <div className={styles.actionRow}>
                <button type="submit" className={styles.cardButton}>
                  Create Thread
                </button>
                <button type="button" className={styles.ghostButton} onClick={() => setComposerKind(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {composerKind === 'pattern' ? (
            <form
              className={styles.stagedComposer}
              onSubmit={async (event) => {
                event.preventDefault();
                const didCreate = await onCreateStagedPattern({
                  title: newPatternTitle,
                  trayAnchor: newPatternAnchor,
                });

                if (!didCreate) {
                  return;
                }

                setNewPatternTitle('');
                setNewPatternAnchor('now');
                setComposerKind(null);
              }}
            >
              <input
                className={styles.editorInput}
                data-testid="new-pattern-title-input"
                placeholder="Pattern title"
                value={newPatternTitle}
                onChange={(event) => setNewPatternTitle(event.target.value)}
              />
              <select
                className={styles.editorSelect}
                data-testid="new-pattern-anchor-select"
                value={newPatternAnchor}
                onChange={(event) => setNewPatternAnchor(event.target.value as BoardTimelineAnchor)}
              >
                <option value="past">Past tray</option>
                <option value="now">Now tray</option>
                <option value="future_possible">Future tray</option>
              </select>
              <div className={styles.actionRow}>
                <button type="submit" className={styles.cardButton}>
                  Create Pattern
                </button>
                <button type="button" className={styles.ghostButton} onClick={() => setComposerKind(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function TimelineBar({
  summary,
  selectedKey,
  showStagingTray,
  stagedNotesBySegment,
  selectedNoteId,
  draggingNoteId,
  onSelectStagedNote,
  onStartStagedDrag,
  onEndStagedDrag,
}: {
  summary: Record<'past' | 'now' | 'future', number>;
  selectedKey: 'past' | 'now' | 'future';
  showStagingTray: boolean;
  stagedNotesBySegment: Record<'past' | 'now' | 'future', BoardStagedNote[]>;
  selectedNoteId: string;
  draggingNoteId: string | null;
  onSelectStagedNote: (noteId: string) => void;
  onStartStagedDrag: (noteId: string | null) => void;
  onEndStagedDrag: () => void;
}) {
  const segments: Array<{ key: 'past' | 'now' | 'future'; label: string }> = [
    { key: 'past', label: 'Past' },
    { key: 'now', label: 'Now' },
    { key: 'future', label: 'Future' },
  ];

  return (
    <footer className={styles.timelineBar}>
      {segments.map((segment) => {
        const isActive = segment.key === selectedKey;
        const dots = Math.max(summary[segment.key], 1);

        return (
          <div
            key={segment.key}
            className={`${styles.timelineSegment} ${isActive ? styles.timelineSegmentActive : ''}`}
          >
            <div className={styles.timelineSegmentLabel}>
              <span className={styles.timelineSegmentTitle}>{segment.label}</span>
              <span className={styles.timelineCount}>{`${summary[segment.key]} threads`}</span>
            </div>
            <div className={styles.timelineDots}>
              {Array.from({ length: Math.min(dots, 5) }).map((_, dotIndex) => (
                <span
                  key={`${segment.key}-${dotIndex}`}
                  className={`${styles.timelineDot} ${isActive && dotIndex === 0 ? styles.timelineDotActive : ''}`}
                />
              ))}
            </div>
            {showStagingTray ? (
              <div className={styles.timelineTray} data-testid={`staged-tray-${segment.key}`}>
                {stagedNotesBySegment[segment.key].length > 0 ? (
                  stagedNotesBySegment[segment.key].map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      draggable
                      data-testid={`staged-note-chip-${note.id}`}
                      className={`${styles.timelineTrayChip} ${
                        selectedNoteId === note.id ? styles.timelineTrayChipSelected : ''
                      } ${draggingNoteId === note.id ? styles.timelineTrayChipDragging : ''}`}
                      onClick={() => onSelectStagedNote(note.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', note.id);
                        onStartStagedDrag(note.id);
                      }}
                      onDragEnd={onEndStagedDrag}
                    >
                      <span className={styles.timelineTrayChipType}>{note.type === 'thread' ? 'Thread' : 'Pattern'}</span>
                      <span className={styles.timelineTrayChipTitle}>{note.title}</span>
                    </button>
                  ))
                ) : (
                  <p className={styles.timelineTrayEmpty}>No staged notes</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </footer>
  );
}
