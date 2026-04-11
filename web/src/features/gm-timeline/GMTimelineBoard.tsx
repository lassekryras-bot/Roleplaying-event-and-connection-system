'use client';

import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, EmptyState, Input, Select, Toast } from '@/components/ui';
import { useAuth } from '@/contexts/auth-context';
import type {
  Check,
  CheckResult,
  Hook,
  Place,
  ReadAloudSection,
  Session,
  ThreadRef,
  Timeline,
} from '@/generated/gm-timeline';
import { normalizeFrontendRole } from '@/lib/roles';
import { formatGmTimelineDiagnostic } from '@/server/gm-timeline/errors';

import { fetchGmTimelineBoard } from './api';
import styles from './GMTimelineBoard.module.css';
import type { GmTimelineBoardPayload } from './types';

const VISIBLE_PAST_SESSIONS = 1;
const VISIBLE_FUTURE_SESSIONS = 3;

type ToastState = {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
};

type SearchKind = 'session' | 'place' | 'hook' | 'thread';

type SearchResult = {
  kind: SearchKind;
  id: string;
  label: string;
  summary: string;
  placeId?: string;
  attachedToFocusedSession?: boolean;
};

function sortSessions(left: Session, right: Session) {
  return left.sequence - right.sequence || left.headline.localeCompare(right.headline);
}

function buildSessionOrder(payload: Pick<GmTimelineBoardPayload, 'sessions' | 'timeline'>): string[] {
  const sessionsById = new Map(payload.sessions.map((session) => [session.id, session]));

  if (!payload.timeline) {
    return payload.sessions.slice().sort(sortSessions).map((session) => session.id);
  }

  const orderedIds = payload.timeline.sessionIds.filter((sessionId) => sessionsById.has(sessionId));
  const listedIds = new Set(orderedIds);
  const unlistedIds = payload.sessions
    .slice()
    .sort(sortSessions)
    .map((session) => session.id)
    .filter((sessionId) => !listedIds.has(sessionId));

  return [...orderedIds, ...unlistedIds];
}

function resolveCurrentSessionId(payload: Pick<GmTimelineBoardPayload, 'sessions' | 'timeline'>): string | null {
  const sessionsById = new Map(payload.sessions.map((session) => [session.id, session]));
  const activeSessionId = payload.timeline?.activeSessionId ?? null;

  if (activeSessionId && sessionsById.has(activeSessionId)) {
    return activeSessionId;
  }

  const orderedSessions = buildSessionOrder(payload)
    .map((sessionId) => sessionsById.get(sessionId) ?? null)
    .filter((session): session is Session => session !== null);

  const sequenceMatch =
    orderedSessions.find((session) => session.sequence === payload.timeline?.currentSequence && session.status !== 'archived') ??
    null;
  if (sequenceMatch) {
    return sequenceMatch.id;
  }

  const planningSession = orderedSessions.find((session) => session.status === 'planning') ?? null;
  return planningSession?.id ?? orderedSessions[0]?.id ?? null;
}

function formatSessionState(status: Session['status']) {
  switch (status) {
    case 'planning':
      return 'Planning';
    case 'active':
      return 'Active';
    case 'ended':
      return 'Ended';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

function formatHookState(status: Hook['status']) {
  return status.replace(/_/g, ' ');
}

function getSessionTone(status: Session['status']) {
  if (status === 'active') {
    return 'active';
  }

  if (status === 'ended' || status === 'archived') {
    return 'ended';
  }

  return 'planning';
}

function getHookTone(status: Hook['status']) {
  switch (status) {
    case 'in_progress':
      return 'progress';
    case 'resolved':
      return 'resolved';
    case 'discarded':
      return 'discarded';
    default:
      return 'available';
  }
}

function buildPlaceMap(places: Place[]) {
  return new Map(places.map((place) => [place.id, place]));
}

function buildHookMap(hooks: Hook[]) {
  return new Map(hooks.map((hook) => [hook.id, hook]));
}

function buildThreadMap(threadRefs: ThreadRef[]) {
  return new Map(threadRefs.map((threadRef) => [threadRef.id, threadRef]));
}

function countUnresolvedHooks(place: Place, hookById: Map<string, Hook>) {
  return place.hookIds.reduce((count, hookId) => {
    const hook = hookById.get(hookId);
    if (!hook || hook.status === 'resolved' || hook.status === 'discarded') {
      return count;
    }

    return count + 1;
  }, 0);
}

function countSessionUnresolvedHooks(session: Session, placeById: Map<string, Place>, hookById: Map<string, Hook>) {
  return session.placeIds.reduce((count, placeId) => {
    const place = placeById.get(placeId);
    return place ? count + countUnresolvedHooks(place, hookById) : count;
  }, 0);
}

function compareHeadlines<T extends { headline: string }>(left: T, right: T) {
  return left.headline.localeCompare(right.headline);
}

function moveItem(array: string[], fromIndex: number, toIndex: number) {
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function formatLoadedAt(loadedAt: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(loadedAt));
}

function findSessionForPlace(sessions: Session[], placeId: string) {
  return sessions.find((session) => session.placeIds.includes(placeId)) ?? null;
}

function findSessionForHook(sessions: Session[], hook: Hook) {
  return findSessionForPlace(sessions, hook.placeId);
}

function SectionList({
  sections,
  onToggle,
}: {
  sections: ReadAloudSection[] | undefined;
  onToggle: (sectionId: string) => void;
}) {
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeadingRow}>
        <h4>Read-Aloud</h4>
        <span>{sections.filter((section) => section.completed).length}/{sections.length} complete</span>
      </div>
      <ul className={styles.sectionList}>
        {sections.map((section) => (
          <li key={section.id} className={`${styles.sectionItem} ${section.completed ? styles.sectionItemComplete : ''}`}>
            <label className={styles.sectionToggle}>
              <input type="checkbox" checked={section.completed} onChange={() => onToggle(section.id)} />
              <div>
                <strong>{section.header}</strong>
                <span>{section.trigger}</span>
              </div>
            </label>
            <p>{section.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionCard({
  session,
  tone,
  selected,
  muted,
  onSelect,
  children,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  testId,
  compact = false,
  menuItems = [],
  className = '',
  buttonClassName = '',
}: {
  session: Session;
  tone: 'planning' | 'active' | 'ended';
  selected: boolean;
  muted?: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLElement>;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  onDragEnd?: React.DragEventHandler<HTMLElement>;
  testId?: string;
  compact?: boolean;
  menuItems?: Array<{
    label: string;
    onSelect: () => void;
    disabled?: boolean;
  }>;
  className?: string;
  buttonClassName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <article
      className={`${styles.sessionCard} ${styles[`sessionCard${tone[0].toUpperCase()}${tone.slice(1)}`]} ${
        selected ? styles.sessionCardSelected : ''
      } ${muted ? styles.sessionCardMuted : ''} ${compact ? styles.sessionCardCompact : ''} ${className}`}
      data-testid={testId}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {compact && menuItems.length > 0 ? (
        <div ref={menuRef} className={styles.sessionCardMenuWrap}>
          <button
            type="button"
            className={`${styles.menuTrigger} ${styles.compactMenuTrigger}`}
            aria-label={`Session ${session.sequence} actions`}
            onClick={() => setMenuOpen((value) => !value)}
          >
            ...
          </button>
          {menuOpen ? (
            <div className={styles.contextMenu} role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    setMenuOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={`${styles.sessionCardButton} ${compact ? styles.sessionCardButtonCompact : ''} ${buttonClassName}`}
        onClick={onSelect}
      >
        <div className={styles.sessionCardHeader}>
          <span className={styles.sessionSequence}>Session {session.sequence}</span>
          {!compact ? (
            <span className={`${styles.sessionChip} ${styles[`sessionChip${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
              {formatSessionState(session.status)}
            </span>
          ) : null}
        </div>
        <h3>{session.headline}</h3>
        {!compact ? (
          <>
            <p>{session.summary ?? session.expectedDirection ?? 'No summary yet.'}</p>
          </>
        ) : null}
      </button>
      {children}
    </article>
  );
}

type SessionFlowBoardProps = {
  currentSession: Session;
  workspaceSession: Session | null;
  visiblePastSessions: Session[];
  hiddenPastSessions: Session[];
  visibleFutureSessions: Session[];
  hiddenFutureSessions: Session[];
  showPastOverflow: boolean;
  showFutureOverflow: boolean;
  showCurrentSessionMenu: boolean;
  canStartCurrentSession: boolean;
  canEndCurrentSession: boolean;
  draggedFutureSessionId: string | null;
  currentSessionMenuRef: React.RefObject<HTMLDivElement | null>;
  addPlaceInputRef: React.RefObject<HTMLInputElement | null>;
  onTogglePastOverflow: () => void;
  onToggleFutureOverflow: () => void;
  onToggleCurrentSessionMenu: () => void;
  onCloseCurrentSessionMenu: () => void;
  onFocusSession: (sessionId: string) => void;
  onStartSession: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onCreateFutureSession: (sessionId: string) => void;
  onMoveFutureSessionByOffset: (sessionId: string, offset: number) => void;
  onPinFutureSession: (sessionId: string) => void;
  onDropFutureSession: (sessionId: string) => void;
  onDragFutureSessionStart: (sessionId: string) => void;
  onDragFutureSessionEnd: () => void;
};

function SessionFlowBoard({
  currentSession,
  workspaceSession,
  visiblePastSessions,
  hiddenPastSessions,
  visibleFutureSessions,
  hiddenFutureSessions,
  showPastOverflow,
  showFutureOverflow,
  showCurrentSessionMenu,
  canStartCurrentSession,
  canEndCurrentSession,
  draggedFutureSessionId,
  currentSessionMenuRef,
  addPlaceInputRef,
  onTogglePastOverflow,
  onToggleFutureOverflow,
  onToggleCurrentSessionMenu,
  onCloseCurrentSessionMenu,
  onFocusSession,
  onStartSession,
  onEndSession,
  onCreateFutureSession,
  onMoveFutureSessionByOffset,
  onPinFutureSession,
  onDropFutureSession,
  onDragFutureSessionStart,
  onDragFutureSessionEnd,
}: SessionFlowBoardProps) {
  const [hoveredFutureSessionId, setHoveredFutureSessionId] = useState<string | null>(null);

  return (
    <section className={styles.sessionFlowBoard} data-testid="gm-timeline-strip">
      <div className={styles.sessionFlowSurface}>
        <div className={styles.flowPastCluster}>
          <div className={styles.flowClusterHeader}>
            <span className={styles.flowClusterLabel}>Past</span>
            {hiddenPastSessions.length > 0 ? (
              <button type="button" className={styles.flowClusterAction} onClick={onTogglePastOverflow}>
                Earlier sessions ({hiddenPastSessions.length})
              </button>
            ) : null}
          </div>
          {showPastOverflow && hiddenPastSessions.length > 0 ? (
            <div className={`${styles.overflowPanel} ${styles.flowOverflowPanel}`}>
              {hiddenPastSessions.map((session) => (
                <button key={session.id} type="button" className={styles.overflowItem} onClick={() => onFocusSession(session.id)}>
                  <strong>{session.headline}</strong>
                  <span>Session {session.sequence}</span>
                </button>
              ))}
            </div>
          ) : null}

          {visiblePastSessions.length > 0 ? (
            visiblePastSessions.map((session) => (
              <div key={session.id} className={styles.flowPastCardShell}>
                <SessionCard
                  session={session}
                  tone="ended"
                  selected={workspaceSession?.id === session.id}
                  muted
                  compact
                  menuItems={[
                    {
                      label: 'Open details',
                      onSelect: () => onFocusSession(session.id),
                    },
                  ]}
                  onSelect={() => onFocusSession(session.id)}
                  testId={`timeline-session-${session.id}`}
                  className={`${styles.flowCard} ${styles.flowCardPast}`}
                  buttonClassName={styles.flowCardButtonCompact}
                />
              </div>
            ))
          ) : (
            <div className={`${styles.timelineEmpty} ${styles.flowEmptyCard}`}>No past sessions yet.</div>
          )}
        </div>

        <div
          className={styles.flowCurrentCluster}
          onContextMenu={(event) => {
            event.preventDefault();
            onToggleCurrentSessionMenu();
          }}
        >
          <span className={styles.flowCurrentBadge}>Current</span>
          <SessionCard
            session={currentSession}
            tone={getSessionTone(currentSession.status)}
            selected={workspaceSession?.id === currentSession.id}
            onSelect={() => onFocusSession(currentSession.id)}
            testId="timeline-current-session"
            className={`${styles.flowCard} ${styles.flowCardCurrent}`}
            buttonClassName={`${styles.flowCardButton} ${styles.flowCardButtonCurrent}`}
          >
            <div ref={currentSessionMenuRef} className={`${styles.currentSessionMenuWrap} ${styles.flowCurrentMenuWrap}`}>
              <button
                type="button"
                className={styles.menuTrigger}
                aria-label="Current session actions"
                onClick={onToggleCurrentSessionMenu}
              >
                ⋯
              </button>
              {showCurrentSessionMenu ? (
                <div className={styles.contextMenu} role="menu">
                  {canStartCurrentSession ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onStartSession(currentSession.id);
                        onCloseCurrentSessionMenu();
                      }}
                    >
                      Start session
                    </button>
                  ) : null}
                  {canEndCurrentSession ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onEndSession(currentSession.id);
                        onCloseCurrentSessionMenu();
                      }}
                    >
                      End session
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      addPlaceInputRef.current?.focus();
                      onCloseCurrentSessionMenu();
                    }}
                  >
                    Add place
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCreateFutureSession(currentSession.id);
                      onCloseCurrentSessionMenu();
                    }}
                  >
                    Create future session after this
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onFocusSession(currentSession.id);
                      onCloseCurrentSessionMenu();
                    }}
                  >
                    Open details
                  </button>
                </div>
              ) : null}
            </div>
          </SessionCard>
        </div>

        <div className={styles.flowFutureCluster}>
          <div className={`${styles.flowClusterHeader} ${styles.flowClusterHeaderFuture}`}>
            <span className={styles.flowClusterLabel}>Future</span>
            {hiddenFutureSessions.length > 0 ? (
              <button type="button" className={styles.flowClusterAction} onClick={onToggleFutureOverflow}>
                More sessions ({hiddenFutureSessions.length})
              </button>
            ) : null}
          </div>
          {showFutureOverflow && hiddenFutureSessions.length > 0 ? (
            <div className={`${styles.overflowPanel} ${styles.flowOverflowPanel}`}>
              {hiddenFutureSessions.map((session) => (
                <div key={session.id} className={styles.overflowFutureItem}>
                  <button type="button" className={styles.overflowItem} onClick={() => onFocusSession(session.id)}>
                    <strong>{session.headline}</strong>
                    <span>Session {session.sequence}</span>
                  </button>
                  <button type="button" className={styles.inlineAction} onClick={() => onPinFutureSession(session.id)}>
                    Pin to strip
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.flowFutureStack}>
            {visibleFutureSessions.length > 0 ? (
              visibleFutureSessions.map((session, index) => (
                <div
                  key={session.id}
                  className={styles.flowFutureRow}
                  onMouseEnter={() => setHoveredFutureSessionId(session.id)}
                  onMouseLeave={() => setHoveredFutureSessionId((currentValue) => (currentValue === session.id ? null : currentValue))}
                >
                  <SessionCard
                    session={session}
                    tone="planning"
                    selected={workspaceSession?.id === session.id}
                    compact
                    menuItems={[
                      {
                        label: 'Open details',
                        onSelect: () => onFocusSession(session.id),
                      },
                      {
                        label: 'Move left',
                        onSelect: () => onMoveFutureSessionByOffset(session.id, -1),
                        disabled: visibleFutureSessions[0]?.id === session.id,
                      },
                      {
                        label: 'Move right',
                        onSelect: () => onMoveFutureSessionByOffset(session.id, 1),
                        disabled: visibleFutureSessions[visibleFutureSessions.length - 1]?.id === session.id,
                      },
                    ]}
                    onSelect={() => onFocusSession(session.id)}
                    draggable
                    onDragStart={() => onDragFutureSessionStart(session.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDropFutureSession(session.id)}
                    onDragEnd={onDragFutureSessionEnd}
                    testId={`timeline-session-${session.id}`}
                    className={`${styles.flowCard} ${styles.flowCardFuture} ${
                      hoveredFutureSessionId === session.id ? styles.flowCardFutureLinked : ''
                    } ${draggedFutureSessionId === session.id ? styles.flowCardFutureDragging : ''}`}
                    buttonClassName={styles.flowCardButtonCompact}
                  />
                </div>
              ))
            ) : (
              <div className={`${styles.timelineEmpty} ${styles.flowEmptyCard}`}>No future sessions yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatRollResult(check: Check) {
  const result = check.result;
  if (!result) {
    return 'No roll recorded yet.';
  }

  const modifier = result.modifier ?? 0;
  const modifierLabel = modifier > 0 ? `+${modifier}` : `${modifier}`;

  return `d20 ${result.rolledValue} ${modifierLabel} = ${result.total} • ${result.outcome.replace(/_/g, ' ')}`;
}

function HookCard({
  hook,
  threads,
  expanded,
  highlighted,
  onToggleExpanded,
  onSetStatus,
  onToggleReadAloud,
  onRollCheck,
}: {
  hook: Hook;
  threads: ThreadRef[];
  expanded: boolean;
  highlighted: boolean;
  onToggleExpanded: () => void;
  onSetStatus: (status: Hook['status']) => void;
  onToggleReadAloud: (sectionId: string) => void;
  onRollCheck: (checkId: string) => void;
}) {
  const tone = getHookTone(hook.status);

  return (
    <article
      id={`hook-card-${hook.id}`}
      className={`${styles.hookCard} ${styles[`hookCard${tone[0].toUpperCase()}${tone.slice(1)}`]} ${
        highlighted ? styles.hookCardHighlighted : ''
      }`}
      data-testid={`hook-card-${hook.id}`}
    >
      <div className={styles.hookHeader}>
        <div>
          <div className={styles.hookHeadlineRow}>
            <h4>{hook.headline}</h4>
            <span className={`${styles.hookChip} ${styles[`hookChip${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
              {formatHookState(hook.status)}
            </span>
          </div>
          <p>{hook.description}</p>
        </div>
        <div className={styles.hookHeaderActions}>
          <span className={styles.priorityPill}>{hook.priority ?? 'medium'}</span>
          <button type="button" className={styles.linkButton} onClick={onToggleExpanded}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      <div className={styles.hookActionRow}>
        {(['available', 'in_progress', 'resolved', 'discarded'] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={`${styles.statusButton} ${hook.status === status ? styles.statusButtonActive : ''}`}
            onClick={() => onSetStatus(status)}
          >
            {formatHookState(status)}
          </button>
        ))}
      </div>

      <div className={styles.threadRow}>
        {threads.length > 0 ? (
          threads.map((thread) => (
            <span key={thread.id} className={styles.threadChip}>
              {thread.title}
            </span>
          ))
        ) : (
          <span className={styles.mutedCopy}>No linked threads.</span>
        )}
      </div>

      {expanded ? (
        <div className={styles.hookBody}>
          {hook.checks.length > 0 ? (
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeadingRow}>
                <h4>Checks</h4>
                <span>{hook.checks.length} ready</span>
              </div>
              <ul className={styles.checkList}>
                {hook.checks.map((check) => (
                  <li key={check.id} className={styles.checkRow}>
                    <div className={styles.checkSummary}>
                      <strong>{check.label}</strong>
                      <span>{`${check.attribute} • DC ${check.dc}`}</span>
                    </div>
                    <div className={styles.checkActions}>
                      <span className={styles.checkResult}>{formatRollResult(check)}</span>
                      {check.rollMode === 'd20_button' ? (
                        <button type="button" className={styles.rollButton} onClick={() => onRollCheck(check.id)}>
                          Roll d20
                        </button>
                      ) : (
                        <span className={styles.manualLabel}>Manual</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <SectionList sections={hook.readAloudSections} onToggle={onToggleReadAloud} />

          {hook.notes ? (
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeadingRow}>
                <h4>Notes</h4>
              </div>
              <p className={styles.noteCopy}>{hook.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function buildSearchResults(
  payload: GmTimelineBoardPayload | null,
  query: string,
  focusedSession: Session | null,
): SearchResult[] {
  if (!payload) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const attachedPlaceIds = new Set(focusedSession?.placeIds ?? []);
  const sessionResults =
    payload.indexes.sessionIndex?.items
      .filter((item) =>
        [item.id, item.headline, item.summary ?? ''].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 4)
      .map<SearchResult>((item) => ({
        kind: 'session',
        id: item.id,
        label: item.headline,
        summary: item.summary ?? `Session ${item.sequence ?? '?'}`,
      })) ?? [];
  const placeResults =
    payload.indexes.placeIndex?.items
      .filter((item) =>
        [item.id, item.headline, item.description ?? '', ...(item.tags ?? [])].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
      .slice(0, 4)
      .map<SearchResult>((item) => ({
        kind: 'place',
        id: item.id,
        label: item.headline,
        summary: item.description ?? (item.tags?.join(' • ') ?? 'Place'),
        attachedToFocusedSession: attachedPlaceIds.has(item.id),
      })) ?? [];
  const hookResults =
    payload.indexes.hookIndex?.items
      .filter((item) =>
        [item.id, item.headline, ...(item.threadIds ?? [])].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 4)
      .map<SearchResult>((item) => ({
        kind: 'hook',
        id: item.id,
        label: item.headline,
        summary: `Hook in ${item.placeId}`,
        placeId: item.placeId,
      })) ?? [];
  const threadResults =
    payload.indexes.threadIndex?.items
      .filter((item) =>
        [item.id, item.title, item.summary ?? ''].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 4)
      .map<SearchResult>((item) => ({
        kind: 'thread',
        id: item.id,
        label: item.title,
        summary: item.summary ?? 'Thread reference',
      })) ?? [];

  return [...sessionResults, ...placeResults, ...hookResults, ...threadResults];
}

function applySessionOrder(payload: GmTimelineBoardPayload, nextSessionOrder: string[]) {
  const sessionsById = new Map(payload.sessions.map((session) => [session.id, session]));
  const reorderedSessions = nextSessionOrder
    .map((sessionId, index) => {
      const session = sessionsById.get(sessionId);
      return session ? { ...session, sequence: index + 1 } : null;
    })
    .filter((session): session is Session => session !== null);
  const currentSessionId = resolveCurrentSessionId({
    timeline: payload.timeline
      ? {
          ...payload.timeline,
          sessionIds: nextSessionOrder,
        }
      : null,
    sessions: reorderedSessions,
  });
  const currentSession = currentSessionId
    ? reorderedSessions.find((session) => session.id === currentSessionId) ?? null
    : null;

  return {
    ...payload,
    sessions: reorderedSessions,
    timeline: payload.timeline
      ? {
          ...payload.timeline,
          sessionIds: nextSessionOrder,
          currentSequence: currentSession?.sequence ?? payload.timeline.currentSequence,
          updatedAt: new Date().toISOString(),
        }
      : payload.timeline,
    loadedAt: new Date().toISOString(),
  };
}

function updatePlaceReadAloudSection(place: Place, sectionId: string): Place {
  return {
    ...place,
    readAloudSections: (place.readAloudSections ?? []).map((section) =>
      section.id === sectionId ? { ...section, completed: !section.completed } : section,
    ),
    updatedAt: new Date().toISOString(),
  };
}

function updateHookReadAloudSection(hook: Hook, sectionId: string): Hook {
  return {
    ...hook,
    readAloudSections: (hook.readAloudSections ?? []).map((section) =>
      section.id === sectionId ? { ...section, completed: !section.completed } : section,
    ),
    updatedAt: new Date().toISOString(),
  };
}

function resolveOutcome(rolledValue: number, total: number, dc: number): CheckResult['outcome'] {
  if (rolledValue === 20) {
    return 'critical_success';
  }

  if (rolledValue === 1) {
    return 'critical_failure';
  }

  return total >= dc ? 'success' : 'failure';
}

function updateHookCheckResult(hook: Hook, checkId: string, result: CheckResult): Hook {
  return {
    ...hook,
    checks: hook.checks.map((check) => (check.id === checkId ? { ...check, result } : check)),
    updatedAt: new Date().toISOString(),
  };
}

export function GMTimelineBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role } = useAuth();
  const normalizedRole = normalizeFrontendRole(role);
  const requestedProjectId = searchParams.get('project') ?? undefined;
  const [payload, setPayload] = useState<GmTimelineBoardPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [expandedHookIds, setExpandedHookIds] = useState<string[]>([]);
  const [highlightedHookId, setHighlightedHookId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [showPastOverflow, setShowPastOverflow] = useState(false);
  const [showFutureOverflow, setShowFutureOverflow] = useState(false);
  const [showCurrentSessionMenu, setShowCurrentSessionMenu] = useState(false);
  const [draggedFutureSessionId, setDraggedFutureSessionId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(globalSearchQuery);
  const deferredPlaceSearchQuery = useDeferredValue(placeSearchQuery);
  const requestIdRef = useRef(0);
  const currentSessionMenuRef = useRef<HTMLDivElement | null>(null);
  const addPlaceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toast.id ? null : currentToast));
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    if (!showCurrentSessionMenu) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!currentSessionMenuRef.current?.contains(event.target as Node)) {
        setShowCurrentSessionMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCurrentSessionMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCurrentSessionMenu]);

  async function loadBoard(
    projectId: string | undefined,
    options: {
      preserveFocusId?: string | null;
      toastOnSuccess?: boolean;
    } = {},
  ) {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    setLoadError('');
    if (payload) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextPayload = await fetchGmTimelineBoard(projectId);
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      startTransition(() => {
        setPayload(nextPayload);
        const fallbackSessionId = resolveCurrentSessionId(nextPayload);
        const preservedFocusId = options.preserveFocusId;
        const nextFocusId =
          preservedFocusId && nextPayload.sessions.some((session) => session.id === preservedFocusId)
            ? preservedFocusId
            : fallbackSessionId;
        setFocusedSessionId(nextFocusId);
        setSelectedPlaceId(null);
        setExpandedHookIds([]);
        setHighlightedHookId(null);
        setShowPastOverflow(false);
        setShowFutureOverflow(false);

        if (options.toastOnSuccess) {
          const invalidFiles = nextPayload.counts.invalidFiles;
          setToast({
            id: Date.now(),
            message:
              invalidFiles > 0
                ? `${invalidFiles} files invalid, ${nextPayload.counts.filesLoaded} loaded.`
                : 'Refreshed successfully.',
            tone: invalidFiles > 0 ? 'warning' : 'success',
          });
        }
      });
    } catch (error) {
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setLoadError(error instanceof Error ? error.message : 'Failed to load GM timeline board.');
      setToast({
        id: Date.now(),
        message: 'Refresh failed. Please try again.',
        tone: 'danger',
      });
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    if (!isAuthenticated && normalizedRole === '') {
      return;
    }

    if (normalizedRole !== '' && normalizedRole !== 'gm') {
      return;
    }

    void loadBoard(requestedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedProjectId, isAuthenticated, normalizedRole]);

  const orderedSessions = useMemo(() => {
    if (!payload) {
      return [];
    }

    const sessionsById = new Map(payload.sessions.map((session) => [session.id, session]));
    return buildSessionOrder(payload)
      .map((sessionId) => sessionsById.get(sessionId) ?? null)
      .filter((session): session is Session => session !== null);
  }, [payload]);

  const sessionById = useMemo(() => new Map((payload?.sessions ?? []).map((session) => [session.id, session])), [payload?.sessions]);
  const placeById = useMemo(() => buildPlaceMap(payload?.places ?? []), [payload?.places]);
  const hookById = useMemo(() => buildHookMap(payload?.hooks ?? []), [payload?.hooks]);
  const threadById = useMemo(() => buildThreadMap(payload?.threadRefs ?? []), [payload?.threadRefs]);
  const currentSessionId = useMemo(() => (payload ? resolveCurrentSessionId(payload) : null), [payload]);
  const currentSession = currentSessionId ? sessionById.get(currentSessionId) ?? null : null;
  const focusedSession = focusedSessionId ? sessionById.get(focusedSessionId) ?? null : null;
  const workspaceSession = focusedSession ?? currentSession;
  const workspacePlaces = useMemo(
    () =>
      workspaceSession?.placeIds
        .map((placeId) => placeById.get(placeId) ?? null)
        .filter((place): place is Place => place !== null) ?? [],
    [placeById, workspaceSession],
  );
  const selectedPlace = selectedPlaceId ? placeById.get(selectedPlaceId) ?? null : workspacePlaces[0] ?? null;
  const selectedPlaceHooks = useMemo(
    () =>
      selectedPlace?.hookIds
        .map((hookId) => hookById.get(hookId) ?? null)
        .filter((hook): hook is Hook => hook !== null) ?? [],
    [hookById, selectedPlace],
  );
  const hasActiveSession = Boolean(payload?.timeline?.activeSessionId);
  const canStartCurrentSession = Boolean(currentSession && currentSession.status === 'planning' && !hasActiveSession);
  const canEndCurrentSession = Boolean(currentSession && currentSession.status === 'active');

  useEffect(() => {
    if (!payload) {
      return;
    }

    const fallbackSessionId = resolveCurrentSessionId(payload) ?? orderedSessions[0]?.id ?? null;
    setFocusedSessionId((currentFocusedSessionId) => {
      if (currentFocusedSessionId && sessionById.has(currentFocusedSessionId)) {
        return currentFocusedSessionId;
      }

      return fallbackSessionId;
    });
  }, [orderedSessions, payload, sessionById]);

  useEffect(() => {
    if (!workspaceSession) {
      setSelectedPlaceId(null);
      return;
    }

    setSelectedPlaceId((currentSelectedPlaceId) => {
      if (currentSelectedPlaceId && workspaceSession.placeIds.includes(currentSelectedPlaceId)) {
        return currentSelectedPlaceId;
      }

      return workspaceSession.placeIds[0] ?? null;
    });
  }, [workspaceSession]);

  useEffect(() => {
    if (!highlightedHookId) {
      return;
    }

    const element = document.getElementById(`hook-card-${highlightedHookId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedHookId]);

  function updatePayload(updater: (currentPayload: GmTimelineBoardPayload) => GmTimelineBoardPayload) {
    setPayload((currentPayload) => (currentPayload ? updater(currentPayload) : currentPayload));
  }

  const searchResults = useMemo(
    () => buildSearchResults(payload, deferredSearchQuery, workspaceSession),
    [deferredSearchQuery, payload, workspaceSession],
  );

  const availablePlaces = useMemo(() => {
    if (!payload || !workspaceSession) {
      return [];
    }

    const attachedPlaceIds = new Set(workspaceSession.placeIds);
    const normalizedQuery = deferredPlaceSearchQuery.trim().toLowerCase();

    return payload.places
      .filter((place) => !attachedPlaceIds.has(place.id))
      .filter((place) => {
        if (!normalizedQuery) {
          return true;
        }

        return [place.id, place.headline, place.description, ...(place.tags ?? [])].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort(compareHeadlines)
      .slice(0, 6);
  }, [deferredPlaceSearchQuery, payload, workspaceSession]);

  function handleProjectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextProjectId = event.target.value;
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextProjectId) {
      nextParams.set('project', nextProjectId);
    } else {
      nextParams.delete('project');
    }

    router.replace(`/timeline${nextParams.size > 0 ? `?${nextParams.toString()}` : ''}`);
  }

  function handleRefresh() {
    void loadBoard(payload?.project?.id ?? requestedProjectId, {
      preserveFocusId: workspaceSession?.id ?? null,
      toastOnSuccess: true,
    });
  }

  function handleFocusSession(sessionId: string) {
    setFocusedSessionId(sessionId);
    setGlobalSearchQuery('');
    setShowPastOverflow(false);
    setShowFutureOverflow(false);
  }

  function handleStartSession(sessionId: string) {
    updatePayload((currentPayload) => {
      const startedAt = new Date().toISOString();
      const sessions: Session[] = currentPayload.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, status: 'active', startedAt, endedAt: null, updatedAt: startedAt }
          : session,
      );
      const activeSession = sessions.find((session) => session.id === sessionId) ?? null;

      return {
        ...currentPayload,
        sessions,
        timeline: currentPayload.timeline
          ? {
              ...currentPayload.timeline,
              activeSessionId: sessionId,
              currentSequence: activeSession?.sequence ?? currentPayload.timeline.currentSequence,
              updatedAt: startedAt,
            }
          : currentPayload.timeline,
        loadedAt: startedAt,
      };
    });
    setFocusedSessionId(sessionId);
    setShowCurrentSessionMenu(false);
    setToast({
      id: Date.now(),
      message: 'Session started.',
      tone: 'success',
    });
  }

  function handleEndSession(sessionId: string) {
    const currentIndex = orderedSessions.findIndex((session) => session.id === sessionId);
    const nextPlanningSession = orderedSessions.slice(currentIndex + 1).find((session) => session.status === 'planning') ?? null;

    updatePayload((currentPayload) => {
      const endedAt = new Date().toISOString();
      const sessions: Session[] = currentPayload.sessions.map((session) =>
        session.id === sessionId ? { ...session, status: 'ended', endedAt, updatedAt: endedAt } : session,
      );
      return {
        ...currentPayload,
        sessions,
        timeline: currentPayload.timeline
          ? {
              ...currentPayload.timeline,
              activeSessionId: null,
              currentSequence: nextPlanningSession?.sequence ?? currentPayload.timeline.currentSequence,
              updatedAt: endedAt,
            }
          : currentPayload.timeline,
        loadedAt: endedAt,
      };
    });
    setFocusedSessionId(nextPlanningSession?.id ?? sessionId);
    setShowCurrentSessionMenu(false);
    setToast({
      id: Date.now(),
      message: 'Session ended.',
      tone: 'info',
    });
  }

  function handleCreateFutureSession(afterSessionId: string) {
    updatePayload((currentPayload) => {
      const orderedIds = buildSessionOrder(currentPayload);
      const insertIndex = orderedIds.indexOf(afterSessionId) + 1;
      const newSessionId = `session-${Date.now().toString(36)}`;
      const createdAt = new Date().toISOString();
      const newSession: Session = {
        id: newSessionId,
        campaignId: currentPayload.timeline?.campaignId ?? currentPayload.project?.id ?? 'project-3',
        sequence: insertIndex + 1,
        status: 'planning',
        headline: `Session ${insertIndex + 1}: New lead`,
        summary: 'Fresh planning slot for the next likely session.',
        expectedDirection: 'Add places and arrange the next likely route.',
        placeIds: [],
        notes: 'Created from the GM timeline board.',
        updatedAt: createdAt,
      };
      const nextPayload = {
        ...currentPayload,
        sessions: [...currentPayload.sessions, newSession],
        loadedAt: createdAt,
      };

      return applySessionOrder(nextPayload, [
        ...orderedIds.slice(0, insertIndex),
        newSessionId,
        ...orderedIds.slice(insertIndex),
      ]);
    });
    setShowCurrentSessionMenu(false);
    setToast({
      id: Date.now(),
      message: 'Future session created.',
      tone: 'success',
    });
  }

  function handleMoveFutureSessionByOffset(sessionId: string, offset: number) {
    if (!payload || !currentSessionId) {
      return;
    }

    const orderedIds = buildSessionOrder(payload);
    const currentIndex = orderedIds.indexOf(currentSessionId);
    const futureIds = orderedIds.slice(currentIndex + 1);
    const fromIndex = futureIds.indexOf(sessionId);
    const toIndex = fromIndex + offset;

    if (fromIndex === -1 || toIndex < 0 || toIndex >= futureIds.length) {
      return;
    }

    updatePayload((currentPayload) =>
      applySessionOrder(currentPayload, [
        ...orderedIds.slice(0, currentIndex + 1),
        ...moveItem(futureIds, fromIndex, toIndex),
      ]),
    );
  }

  function handlePinFutureSession(sessionId: string) {
    if (!payload || !currentSessionId) {
      return;
    }

    const orderedIds = buildSessionOrder(payload);
    const currentIndex = orderedIds.indexOf(currentSessionId);
    const futureIds = orderedIds.slice(currentIndex + 1);
    const fromIndex = futureIds.indexOf(sessionId);
    if (fromIndex <= 0) {
      return;
    }

    updatePayload((currentPayload) =>
      applySessionOrder(currentPayload, [
        ...orderedIds.slice(0, currentIndex + 1),
        ...moveItem(futureIds, fromIndex, 0),
      ]),
    );
    setShowFutureOverflow(false);
  }

  function handleDropFutureSession(targetSessionId: string) {
    if (!payload || !currentSessionId || !draggedFutureSessionId || draggedFutureSessionId === targetSessionId) {
      return;
    }

    const orderedIds = buildSessionOrder(payload);
    const currentIndex = orderedIds.indexOf(currentSessionId);
    const futureIds = orderedIds.slice(currentIndex + 1);
    const fromIndex = futureIds.indexOf(draggedFutureSessionId);
    const targetIndex = futureIds.indexOf(targetSessionId);

    if (fromIndex === -1 || targetIndex === -1) {
      return;
    }

    updatePayload((currentPayload) =>
      applySessionOrder(currentPayload, [
        ...orderedIds.slice(0, currentIndex + 1),
        ...moveItem(futureIds, fromIndex, targetIndex),
      ]),
    );
    setDraggedFutureSessionId(null);
  }

  function handleAttachPlace(placeId: string) {
    if (!workspaceSession) {
      return;
    }

    updatePayload((currentPayload) => ({
      ...currentPayload,
      sessions: currentPayload.sessions.map((session) =>
        session.id === workspaceSession.id && !session.placeIds.includes(placeId)
          ? { ...session, placeIds: [...session.placeIds, placeId], updatedAt: new Date().toISOString() }
          : session,
      ),
      loadedAt: new Date().toISOString(),
    }));
    setSelectedPlaceId(placeId);
    setPlaceSearchQuery('');
  }

  function handleRemovePlace(placeId: string) {
    if (!workspaceSession) {
      return;
    }

    const remainingPlaceIds = workspaceSession.placeIds.filter((currentPlaceId) => currentPlaceId !== placeId);

    updatePayload((currentPayload) => ({
      ...currentPayload,
      sessions: currentPayload.sessions.map((session) =>
        session.id === workspaceSession.id
          ? {
              ...session,
              placeIds: session.placeIds.filter((currentPlaceId) => currentPlaceId !== placeId),
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
      loadedAt: new Date().toISOString(),
    }));
    setSelectedPlaceId((currentSelectedPlaceId) =>
      currentSelectedPlaceId === placeId ? remainingPlaceIds[0] ?? null : currentSelectedPlaceId,
    );
  }

  function handleMovePlace(placeId: string, offset: number) {
    if (!workspaceSession) {
      return;
    }

    const fromIndex = workspaceSession.placeIds.indexOf(placeId);
    const toIndex = fromIndex + offset;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= workspaceSession.placeIds.length) {
      return;
    }

    updatePayload((currentPayload) => ({
      ...currentPayload,
      sessions: currentPayload.sessions.map((session) =>
        session.id === workspaceSession.id
          ? {
              ...session,
              placeIds: moveItem(session.placeIds, fromIndex, toIndex),
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
      loadedAt: new Date().toISOString(),
    }));
  }

  function handleTogglePlaceReadAloud(placeId: string, sectionId: string) {
    updatePayload((currentPayload) => ({
      ...currentPayload,
      places: currentPayload.places.map((place) =>
        place.id === placeId ? updatePlaceReadAloudSection(place, sectionId) : place,
      ),
      loadedAt: new Date().toISOString(),
    }));
  }

  function handleToggleHookExpanded(hookId: string) {
    setExpandedHookIds((currentExpandedHookIds) =>
      currentExpandedHookIds.includes(hookId)
        ? currentExpandedHookIds.filter((currentHookId) => currentHookId !== hookId)
        : [...currentExpandedHookIds, hookId],
    );
  }

  function handleSetHookStatus(hookId: string, status: Hook['status']) {
    updatePayload((currentPayload) => ({
      ...currentPayload,
      hooks: currentPayload.hooks.map<Hook>((hook) =>
        hook.id === hookId ? { ...hook, status, updatedAt: new Date().toISOString() } : hook,
      ),
      loadedAt: new Date().toISOString(),
    }));
  }

  function handleToggleHookReadAloud(hookId: string, sectionId: string) {
    updatePayload((currentPayload) => ({
      ...currentPayload,
      hooks: currentPayload.hooks.map((hook) =>
        hook.id === hookId ? updateHookReadAloudSection(hook, sectionId) : hook,
      ),
      loadedAt: new Date().toISOString(),
    }));
  }

  function handleRollCheck(hookId: string, checkId: string) {
    const hook = hookById.get(hookId);
    const check = hook?.checks.find((entry) => entry.id === checkId) ?? null;
    if (!hook || !check) {
      return;
    }

    const rolledValue = Math.max(1, Math.ceil(Math.random() * 20));
    const modifier = check.result?.modifier ?? 0;
    const total = rolledValue + modifier;
    const result: CheckResult = {
      rolledValue,
      modifier,
      total,
      outcome: resolveOutcome(rolledValue, total, check.dc),
      recordedAt: new Date().toISOString(),
    };

    updatePayload((currentPayload) => ({
      ...currentPayload,
      hooks: currentPayload.hooks.map((currentHook) =>
        currentHook.id === hookId ? updateHookCheckResult(currentHook, checkId, result) : currentHook,
      ),
      loadedAt: new Date().toISOString(),
    }));
    setExpandedHookIds((currentExpandedHookIds) =>
      currentExpandedHookIds.includes(hookId) ? currentExpandedHookIds : [...currentExpandedHookIds, hookId],
    );
  }

  function handleSearchResult(result: SearchResult) {
    if (!payload) {
      return;
    }

    if (result.kind === 'session') {
      setFocusedSessionId(result.id);
      setGlobalSearchQuery('');
      return;
    }

    if (result.kind === 'place') {
      if (workspaceSession?.placeIds.includes(result.id)) {
        setSelectedPlaceId(result.id);
      } else {
        handleAttachPlace(result.id);
      }
      setGlobalSearchQuery('');
      return;
    }

    if (result.kind === 'hook') {
      const hook = hookById.get(result.id);
      if (!hook) {
        return;
      }

      const owningSession = findSessionForHook(orderedSessions, hook) ?? workspaceSession;
      if (owningSession) {
        setFocusedSessionId(owningSession.id);
      }
      setSelectedPlaceId(hook.placeId);
      setExpandedHookIds((currentExpandedHookIds) =>
        currentExpandedHookIds.includes(hook.id) ? currentExpandedHookIds : [...currentExpandedHookIds, hook.id],
      );
      setHighlightedHookId(hook.id);
      setGlobalSearchQuery('');
      return;
    }

    const thread = threadById.get(result.id);
    const linkedHookId = thread?.linkedHookIds[0] ?? null;
    if (!linkedHookId) {
      return;
    }

    const hook = hookById.get(linkedHookId);
    if (!hook) {
      return;
    }

    const owningSession = findSessionForHook(orderedSessions, hook) ?? workspaceSession;
    if (owningSession) {
      setFocusedSessionId(owningSession.id);
    }
    setSelectedPlaceId(hook.placeId);
    setExpandedHookIds((currentExpandedHookIds) =>
      currentExpandedHookIds.includes(hook.id) ? currentExpandedHookIds : [...currentExpandedHookIds, hook.id],
    );
    setHighlightedHookId(hook.id);
    setGlobalSearchQuery('');
  }

  if (!isAuthenticated && normalizedRole === '') {
    return (
      <section className={styles.boardShell}>
        <div className={styles.emptyPanel}>
          <p className={styles.loadingCopy}>Loading GM timeline board…</p>
        </div>
      </section>
    );
  }

  if (normalizedRole !== 'gm') {
    return (
      <section className={styles.boardShell}>
        <div className={styles.emptyPanel}>
          <h1>GM Timeline Board</h1>
          <p>This board is GM-only in the MVP.</p>
        </div>
      </section>
    );
  }

  if (loading && !payload) {
    return (
      <section className={styles.boardShell}>
        <div className={styles.emptyPanel}>
          <p className={styles.loadingCopy}>Loading GM timeline board…</p>
        </div>
      </section>
    );
  }

  if (!payload && !loadError) {
    return (
      <section className={styles.boardShell}>
        <div className={styles.emptyPanel}>
          <p className={styles.loadingCopy}>Loading GM timeline board…</p>
        </div>
      </section>
    );
  }

  if (loadError && !payload) {
    return (
      <section className={styles.boardShell}>
        <div className={styles.emptyPanel}>
          <h1>GM Timeline Board</h1>
          <p>{loadError}</p>
          <Button onClick={handleRefresh}>Retry</Button>
        </div>
      </section>
    );
  }

  const currentIndex = currentSession ? orderedSessions.findIndex((session) => session.id === currentSession.id) : -1;
  const pastSessions = currentIndex > 0 ? orderedSessions.slice(0, currentIndex) : [];
  const visiblePastSessions = pastSessions.slice(-VISIBLE_PAST_SESSIONS);
  const hiddenPastSessions = pastSessions.slice(0, Math.max(0, pastSessions.length - VISIBLE_PAST_SESSIONS));
  const futureSessions = currentIndex >= 0 ? orderedSessions.slice(currentIndex + 1) : [];
  const visibleFutureSessions = futureSessions.slice(0, VISIBLE_FUTURE_SESSIONS);
  const hiddenFutureSessions = futureSessions.slice(VISIBLE_FUTURE_SESSIONS);
  const diagnostics = payload?.diagnostics ?? [];
  const projectLabel = payload?.project?.name ?? 'GM Timeline';
  const futureHeroSlotClasses = [
    styles.heroCardSlotFutureOne,
    styles.heroCardSlotFutureTwo,
    styles.heroCardSlotFutureThree,
  ];

  return (
    <section className={styles.boardShell} data-testid="gm-timeline-board">
      {toast ? <Toast tone={toast.tone}>{toast.message}</Toast> : null}

      <header className={styles.utilityBar}>
        <div className={styles.utilityTitleBlock}>
          <p className={styles.eyebrow}>GM Timeline Board</p>
          <h1>{projectLabel}</h1>
          <span className={styles.utilityMeta}>
            {payload?.timeline?.title ?? 'Session planning and live-run board'} • Updated{' '}
            {payload ? formatLoadedAt(payload.loadedAt) : 'just now'}
          </span>
        </div>

        <div className={styles.utilityControls}>
          <label className={styles.fieldGroup}>
            <span>Project</span>
            <Select
              aria-label="GM timeline project selector"
              value={payload?.project?.id ?? requestedProjectId ?? ''}
              onChange={handleProjectChange}
            >
              {(payload?.projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </label>

          <label className={`${styles.fieldGroup} ${styles.searchField}`}>
            <span>Search</span>
            <Input
              aria-label="Global GM timeline search"
              placeholder="Search sessions, places, hooks, threads"
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
            />
          </label>

          <div className={styles.utilityButtons}>
            <Button
              className={styles.utilityButton}
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="gm-timeline-refresh"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <button
              type="button"
              className={`${styles.warningButton} ${diagnostics.length > 0 ? styles.warningButtonActive : ''}`}
              onClick={() => setShowValidationPanel((currentValue) => !currentValue)}
            >
              {diagnostics.length > 0 ? `${diagnostics.length} warnings` : 'No warnings'}
            </button>
          </div>
        </div>

        {searchResults.length > 0 ? (
          <div className={styles.searchPanel} data-testid="gm-timeline-search-results">
            {searchResults.map((result) => (
              <div key={`${result.kind}-${result.id}`} className={styles.searchResultRow}>
                <button type="button" className={styles.searchResultButton} onClick={() => handleSearchResult(result)}>
                  <span className={styles.searchResultKind}>{result.kind}</span>
                  <strong>{result.label}</strong>
                  <span>{result.summary}</span>
                </button>
                {result.kind === 'place' && !result.attachedToFocusedSession && workspaceSession ? (
                  <button type="button" className={styles.inlineAction} onClick={() => handleAttachPlace(result.id)}>
                    Attach
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </header>

      {showValidationPanel ? (
        <aside className={styles.validationPanel}>
          <div className={styles.validationHeader}>
            <div>
              <p className={styles.eyebrow}>Validation</p>
              <h2>
                {payload?.counts.invalidFiles ? `${payload.counts.invalidFiles} invalid files` : 'All loaded files are valid'}
              </h2>
            </div>
            <button type="button" className={styles.linkButton} onClick={() => setShowValidationPanel(false)}>
              Close
            </button>
          </div>
          {diagnostics.length > 0 ? (
            <ul className={styles.validationList}>
              {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.relativePath}-${index}`} className={styles.validationItem}>
                  <strong>{diagnostic.relativePath}</strong>
                  <span>{diagnostic.contentKind}</span>
                  <p>{formatGmTimelineDiagnostic(diagnostic)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.validationEmpty}>No validation problems reported in the current load.</p>
          )}
        </aside>
      ) : null}

      {currentSession ? (
        <>
          <SessionFlowBoard
            currentSession={currentSession}
            workspaceSession={workspaceSession}
            visiblePastSessions={visiblePastSessions}
            hiddenPastSessions={hiddenPastSessions}
            visibleFutureSessions={visibleFutureSessions}
            hiddenFutureSessions={hiddenFutureSessions}
            showPastOverflow={showPastOverflow}
            showFutureOverflow={showFutureOverflow}
            showCurrentSessionMenu={showCurrentSessionMenu}
            canStartCurrentSession={canStartCurrentSession}
            canEndCurrentSession={canEndCurrentSession}
            draggedFutureSessionId={draggedFutureSessionId}
            currentSessionMenuRef={currentSessionMenuRef}
            addPlaceInputRef={addPlaceInputRef}
            onTogglePastOverflow={() => setShowPastOverflow((value) => !value)}
            onToggleFutureOverflow={() => setShowFutureOverflow((value) => !value)}
            onToggleCurrentSessionMenu={() => setShowCurrentSessionMenu((value) => !value)}
            onCloseCurrentSessionMenu={() => setShowCurrentSessionMenu(false)}
            onFocusSession={handleFocusSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onCreateFutureSession={handleCreateFutureSession}
            onMoveFutureSessionByOffset={handleMoveFutureSessionByOffset}
            onPinFutureSession={handlePinFutureSession}
            onDropFutureSession={handleDropFutureSession}
            onDragFutureSessionStart={(sessionId) => setDraggedFutureSessionId(sessionId)}
            onDragFutureSessionEnd={() => setDraggedFutureSessionId(null)}
          />
          {false ? (
        <section className={styles.timelineStrip} data-testid="gm-timeline-strip">
          <div className={styles.timelineBackgroundLayer} aria-hidden="true">
            <Image
              src="/assets/timeline-bg.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.timelineBackgroundImage}
            />
          </div>
          <div className={styles.timelineBackgroundVeil} aria-hidden="true" />
          <div className={styles.timelineRopeLayer} aria-hidden="true">
            <div className={styles.timelineRopeFrame}>
              <Image
                src="/assets/timeline-rope.png"
                alt=""
                fill
                priority
                sizes="100vw"
                className={styles.timelineRopeImage}
              />
            </div>
          </div>

          <div className={styles.timelineUiLayer}>
            <div className={`${styles.timelineLegend} ${styles.timelineLegendPast}`}>
              <span className={styles.timelineMarkerLabel}>Past</span>
              {hiddenPastSessions.length > 0 ? (
                <button type="button" className={styles.timelineMarkerAction} onClick={() => setShowPastOverflow((value) => !value)}>
                  Earlier sessions ({hiddenPastSessions.length})
                </button>
              ) : (
                <span className={styles.timelineMarkerMeta}>Read-only archive</span>
              )}
              {showPastOverflow && hiddenPastSessions.length > 0 ? (
                <div className={`${styles.overflowPanel} ${styles.timelineOverflowPanel}`}>
                  {hiddenPastSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={styles.overflowItem}
                      onClick={() => handleFocusSession(session.id)}
                    >
                      <strong>{session.headline}</strong>
                      <span>Session {session.sequence}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={`${styles.timelineLegend} ${styles.timelineLegendCurrent}`}>
              <span className={styles.timelineMarkerLabel}>Current Session</span>
              <span className={styles.timelineMarkerMeta}>
                {currentSession!.status === 'active' ? 'Live play ready' : 'Planning focus'}
              </span>
            </div>

            <div className={`${styles.timelineLegend} ${styles.timelineLegendFuture}`}>
              <span className={styles.timelineMarkerLabel}>Future</span>
              {hiddenFutureSessions.length > 0 ? (
                <button type="button" className={styles.timelineMarkerAction} onClick={() => setShowFutureOverflow((value) => !value)}>
                  More sessions ({hiddenFutureSessions.length})
                </button>
              ) : (
                <span className={styles.timelineMarkerMeta}>Branching possibilities</span>
              )}
              {showFutureOverflow && hiddenFutureSessions.length > 0 ? (
                <div className={`${styles.overflowPanel} ${styles.timelineOverflowPanel}`}>
                  {hiddenFutureSessions.map((session) => (
                    <div key={session.id} className={styles.overflowFutureItem}>
                      <button
                        type="button"
                        className={styles.overflowItem}
                        onClick={() => handleFocusSession(session.id)}
                      >
                        <strong>{session.headline}</strong>
                        <span>Session {session.sequence}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.inlineAction}
                        onClick={() => handlePinFutureSession(session.id)}
                      >
                        Pin to strip
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {visiblePastSessions.length > 0 ? (
              visiblePastSessions.map((session) => (
                <div key={session.id} className={`${styles.heroCardSlot} ${styles.heroCardSlotPast}`}>
                  <SessionCard
                    session={session}
                    tone="ended"
                    selected={workspaceSession?.id === session.id}
                    muted
                    compact
                    menuItems={[
                      {
                        label: 'Open details',
                        onSelect: () => handleFocusSession(session.id),
                      },
                    ]}
                    onSelect={() => handleFocusSession(session.id)}
                    testId={`timeline-session-${session.id}`}
                    className={`${styles.heroSessionCard} ${styles.heroSessionCardPast}`}
                    buttonClassName={styles.heroSessionCardButton}
                  />
                </div>
              ))
            ) : (
              <div className={`${styles.timelineEmpty} ${styles.heroEmptyCard} ${styles.heroCardSlot} ${styles.heroCardSlotPast}`}>
                No past sessions yet.
              </div>
            )}

            <div
              className={`${styles.heroCardSlot} ${styles.heroCardSlotCurrent}`}
              onContextMenu={(event) => {
                event.preventDefault();
                setShowCurrentSessionMenu(true);
              }}
            >
              <SessionCard
                session={currentSession!}
                tone={getSessionTone(currentSession!.status)}
                selected={workspaceSession?.id === currentSession!.id}
                onSelect={() => handleFocusSession(currentSession!.id)}
                testId="timeline-current-session"
                className={`${styles.heroSessionCard} ${styles.heroSessionCardCurrent}`}
                buttonClassName={`${styles.heroSessionCardButton} ${styles.heroSessionCardButtonCurrent}`}
              >
                <div ref={currentSessionMenuRef} className={`${styles.currentSessionMenuWrap} ${styles.heroCurrentMenuWrap}`}>
                  <button
                    type="button"
                    className={styles.menuTrigger}
                    aria-label="Current session actions"
                    onClick={() => setShowCurrentSessionMenu((value) => !value)}
                  >
                    ⋯
                  </button>
                  {showCurrentSessionMenu ? (
                    <div className={styles.contextMenu} role="menu">
                      {canStartCurrentSession ? (
                        <button type="button" role="menuitem" onClick={() => handleStartSession(currentSession!.id)}>
                          Start session
                        </button>
                      ) : null}
                      {canEndCurrentSession ? (
                        <button type="button" role="menuitem" onClick={() => handleEndSession(currentSession!.id)}>
                          End session
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          addPlaceInputRef.current?.focus();
                          setShowCurrentSessionMenu(false);
                        }}
                      >
                        Add place
                      </button>
                      <button type="button" role="menuitem" onClick={() => handleCreateFutureSession(currentSession!.id)}>
                        Create future session after this
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setFocusedSessionId(currentSession!.id);
                          setShowCurrentSessionMenu(false);
                        }}
                      >
                        Open details
                      </button>
                    </div>
                  ) : null}
                </div>
              </SessionCard>
            </div>

            {visibleFutureSessions.length > 0 ? (
              visibleFutureSessions.map((session, index) => (
                <div
                  key={session.id}
                  className={`${styles.heroCardSlot} ${styles.heroCardSlotFuture} ${futureHeroSlotClasses[index] ?? ''}`}
                >
                  <SessionCard
                    session={session}
                    tone="planning"
                    selected={workspaceSession?.id === session.id}
                    compact
                    menuItems={[
                      {
                        label: 'Open details',
                        onSelect: () => handleFocusSession(session.id),
                      },
                      {
                        label: 'Move left',
                        onSelect: () => handleMoveFutureSessionByOffset(session.id, -1),
                        disabled: visibleFutureSessions[0]?.id === session.id,
                      },
                      {
                        label: 'Move right',
                        onSelect: () => handleMoveFutureSessionByOffset(session.id, 1),
                        disabled: visibleFutureSessions[visibleFutureSessions.length - 1]?.id === session.id,
                      },
                    ]}
                    onSelect={() => handleFocusSession(session.id)}
                    draggable
                    onDragStart={() => setDraggedFutureSessionId(session.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropFutureSession(session.id)}
                    onDragEnd={() => setDraggedFutureSessionId(null)}
                    testId={`timeline-session-${session.id}`}
                    className={`${styles.heroSessionCard} ${styles.heroSessionCardFuture} ${
                      draggedFutureSessionId === session.id ? styles.heroSessionCardDragging : ''
                    }`}
                    buttonClassName={styles.heroSessionCardButton}
                  />
                </div>
              ))
            ) : (
              <div className={`${styles.timelineEmpty} ${styles.heroEmptyCard} ${styles.heroCardSlot} ${styles.heroCardSlotFutureOne}`}>
                No future sessions yet.
              </div>
            )}
          </div>
        </section>
          ) : null}
        </>
      ) : (
        <div className={styles.emptyWorkspace}>
          <EmptyState
            title="No current session selected"
            description="Create a session or load a project timeline to start planning."
          />
        </div>
      )}
      {workspaceSession ? (
        <section className={styles.workspace} data-testid="gm-timeline-workspace">
          <div className={styles.workspaceHeader}>
            <div>
              <p className={styles.eyebrow}>
                {workspaceSession.id === currentSession?.id ? 'Current session workspace' : 'Inspection workspace'}
              </p>
              <h2>{workspaceSession.headline}</h2>
              <div className={styles.workspaceMeta}>
                <span>Session {workspaceSession.sequence}</span>
                <span className={`${styles.sessionChip} ${styles[`sessionChip${getSessionTone(workspaceSession.status)[0].toUpperCase()}${getSessionTone(workspaceSession.status).slice(1)}`]}`}>
                  {formatSessionState(workspaceSession.status)}
                </span>
              </div>
              <p className={styles.workspaceSummary}>
                {workspaceSession.expectedDirection ?? workspaceSession.summary ?? 'No direction note yet.'}
              </p>
              {workspaceSession.notes ? <p className={styles.workspaceNotes}>{workspaceSession.notes}</p> : null}
            </div>

            <div className={styles.workspaceActions}>
              {workspaceSession.id === currentSession?.id && canStartCurrentSession ? (
                <Button className={styles.utilityButton} onClick={() => handleStartSession(workspaceSession.id)}>
                  Start session
                </Button>
              ) : null}
              {workspaceSession.id === currentSession?.id && canEndCurrentSession ? (
                <Button className={styles.utilityButton} onClick={() => handleEndSession(workspaceSession.id)}>
                  End session
                </Button>
              ) : null}
              <Button className={styles.utilityButton} onClick={() => addPlaceInputRef.current?.focus()}>
                Add place
              </Button>
              <Button className={styles.utilityButton} onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          </div>

          <div className={styles.placeAddRow}>
            <label className={`${styles.fieldGroup} ${styles.placeSearchField}`}>
              <span>Search place index</span>
              <Input
                ref={addPlaceInputRef}
                aria-label="Search places to attach"
                placeholder="Find a place to attach"
                value={placeSearchQuery}
                onChange={(event) => setPlaceSearchQuery(event.target.value)}
              />
            </label>
            <div className={styles.placeSearchResults}>
              {availablePlaces.length > 0 ? (
                availablePlaces.map((place) => (
                  <button key={place.id} type="button" className={styles.placeSearchItem} onClick={() => handleAttachPlace(place.id)}>
                    <strong>{place.headline}</strong>
                    <span>{place.tags?.join(' • ') ?? place.description}</span>
                  </button>
                ))
              ) : (
                <span className={styles.mutedCopy}>No matching unattached places.</span>
              )}
            </div>
          </div>

          <div className={styles.placeRail}>
            {workspacePlaces.length > 0 ? (
              workspacePlaces.map((place) => (
                <article
                  key={place.id}
                  className={`${styles.placeTile} ${selectedPlace?.id === place.id ? styles.placeTileSelected : ''}`}
                >
                  <button type="button" className={styles.placeTileButton} onClick={() => setSelectedPlaceId(place.id)}>
                    <strong>{place.headline}</strong>
                    <span>{place.tags?.join(' • ') ?? 'No tags'}</span>
                    <div className={styles.placeTileMeta}>
                      <span>{place.hookIds.length} hooks</span>
                      <span>{countUnresolvedHooks(place, hookById)} open</span>
                    </div>
                  </button>
                  <div className={styles.placeTileActions}>
                    <button type="button" className={styles.inlineAction} onClick={() => handleMovePlace(place.id, -1)}>
                      Left
                    </button>
                    <button type="button" className={styles.inlineAction} onClick={() => handleMovePlace(place.id, 1)}>
                      Right
                    </button>
                    <button type="button" className={styles.inlineAction} onClick={() => handleRemovePlace(place.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.placeRailEmpty}>
                <p>No places attached yet.</p>
                <button type="button" className={styles.inlineAction} onClick={() => addPlaceInputRef.current?.focus()}>
                  Add place
                </button>
              </div>
            )}
          </div>

          {selectedPlace ? (
            <div className={styles.placePanelGrid}>
              <section className={styles.placePanel}>
                <div className={styles.placePanelHeader}>
                  <div>
                    <p className={styles.eyebrow}>Place</p>
                    <h3>{selectedPlace.headline}</h3>
                  </div>
                  <div className={styles.placeTagRow}>
                    {(selectedPlace.tags ?? []).map((tag) => (
                      <span key={tag} className={styles.placeTag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <p className={styles.placeDescription}>{selectedPlace.description}</p>
                <SectionList
                  sections={selectedPlace.readAloudSections}
                  onToggle={(sectionId) => handleTogglePlaceReadAloud(selectedPlace.id, sectionId)}
                />
                {selectedPlace.notes ? (
                  <div className={styles.sectionBlock}>
                    <div className={styles.sectionHeadingRow}>
                      <h4>GM notes</h4>
                    </div>
                    <p className={styles.noteCopy}>{selectedPlace.notes}</p>
                  </div>
                ) : null}
              </section>

              <section className={styles.hookBoard}>
                <div className={styles.sectionHeadingRow}>
                  <h3>Hook Board</h3>
                  <span>{selectedPlaceHooks.length} hooks</span>
                </div>
                {selectedPlaceHooks.length > 0 ? (
                  <div className={styles.hookGrid}>
                    {selectedPlaceHooks.map((hook) => (
                      <HookCard
                        key={hook.id}
                        hook={hook}
                        threads={hook.threadIds
                          .map((threadId) => threadById.get(threadId) ?? null)
                          .filter((thread): thread is ThreadRef => thread !== null)}
                        expanded={expandedHookIds.includes(hook.id)}
                        highlighted={highlightedHookId === hook.id}
                        onToggleExpanded={() => handleToggleHookExpanded(hook.id)}
                        onSetStatus={(status) => handleSetHookStatus(hook.id, status)}
                        onToggleReadAloud={(sectionId) => handleToggleHookReadAloud(hook.id, sectionId)}
                        onRollCheck={(checkId) => handleRollCheck(hook.id, checkId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.hookEmpty}>
                    <p>No hooks for this place.</p>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className={styles.emptyWorkspace}>
              <EmptyState
                title="No place selected"
                description="Attach a place or select one from the rail to open its hook board."
              />
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
