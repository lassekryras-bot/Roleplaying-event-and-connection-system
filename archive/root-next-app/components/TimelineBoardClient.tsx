'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type TimelineEra = 'past' | 'now' | 'future';
export type ThreadUrgency = 'high' | 'active' | 'passive';

type TimelineThread = {
  id: string;
  title: string;
  era: TimelineEra;
  urgency: ThreadUrgency;
  summary: string;
  details: string;
  linkedTo: string[];
};

const TIMELINE_THREADS: TimelineThread[] = [
  {
    id: 'village-scuffle',
    title: 'Village Scuffle',
    era: 'past',
    urgency: 'passive',
    summary: 'A brawl in Mossgate left behind a coded badge.',
    details: 'Witnesses remember the badge matching a now-defunct city watch patrol.',
    linkedTo: ['lost-temple-rumor'],
  },
  {
    id: 'lantern-signal',
    title: 'Lantern Signal',
    era: 'past',
    urgency: 'active',
    summary: 'Three blue pulses were seen from the old tower.',
    details: 'The signal timing overlaps with the temple map fragment theft.',
    linkedTo: ['lost-temple-rumor'],
  },
  {
    id: 'hidden-passage',
    title: 'Hidden Passage',
    era: 'past',
    urgency: 'high',
    summary: 'A collapsed cellar opened toward forgotten ruins.',
    details: 'Stonemarks identify a cult route still in use during moonless nights.',
    linkedTo: ['cursed-ritual'],
  },
  {
    id: 'lost-temple-rumor',
    title: 'Lost Temple Rumor',
    era: 'now',
    urgency: 'active',
    summary: 'Caravan scouts claim the temple doors have shifted open.',
    details: 'This is the primary active thread and currently drives most player choices.',
    linkedTo: ['ancient-heir', 'cursed-ritual'],
  },
  {
    id: 'supply-cache',
    title: 'Supply Cache',
    era: 'now',
    urgency: 'passive',
    summary: 'A sealed cache can support one hard expedition.',
    details: 'Choosing who receives the cache may reshape faction trust.',
    linkedTo: ['marching-warband'],
  },
  {
    id: 'cursed-ritual',
    title: 'Cursed Ritual',
    era: 'future',
    urgency: 'high',
    summary: 'A ritual window opens at the next red moon.',
    details: 'If unchallenged, this escalates regional corruption and summons hostile spirits.',
    linkedTo: ['marching-warband'],
  },
  {
    id: 'ancient-heir',
    title: 'Ancient Heir',
    era: 'future',
    urgency: 'active',
    summary: 'A claimant to the old dynasty emerges with relic proof.',
    details: 'Their legitimacy can stabilize alliances or ignite succession conflict.',
    linkedTo: ['marching-warband'],
  },
  {
    id: 'marching-warband',
    title: 'Marching Warband',
    era: 'future',
    urgency: 'high',
    summary: 'A warband gathers near the western pass.',
    details: 'Their move depends on whether temple artifacts appear in public trade.',
    linkedTo: [],
  },
];

const ERA_META: Record<TimelineEra, { label: string; x: number }> = {
  past: { label: 'Past', x: 12 },
  now: { label: 'Now', x: 50 },
  future: { label: 'Future', x: 88 },
};

const URGENCY_LABEL: Record<ThreadUrgency, string> = {
  high: 'High urgency',
  active: 'Active',
  passive: 'Passive / discovery',
};

export default function TimelineBoardClient() {
  const [zoom, setZoom] = useState(1);
  const [focusEra, setFocusEra] = useState<'all' | TimelineEra>('all');
  const [selectedId, setSelectedId] = useState<string>('lost-temple-rumor');

  const selectedThread = TIMELINE_THREADS.find((thread) => thread.id === selectedId) ?? TIMELINE_THREADS[0];

  const filteredThreads = useMemo(
    () => TIMELINE_THREADS.filter((thread) => focusEra === 'all' || thread.era === focusEra),
    [focusEra],
  );
  const filteredIds = new Set(filteredThreads.map((thread) => thread.id));
  const threadPositions = filteredThreads.reduce<Record<string, { x: number; y: number }>>((acc, thread, index) => {
    const laneDepth = index % 2 === 0 ? -1 : 1;
    const yOffset = 25 + (Math.floor(index / 2) + 1) * 56;
    acc[thread.id] = { x: ERA_META[thread.era].x, y: yOffset + laneDepth * 16 };
    return acc;
  }, {});

  return (
    <main className="page timeline-shell">
      <div className="timeline-top-row">
        <h1>Timeline Board</h1>
        <Link href="/threads">Back to thread list</Link>
      </div>

      <section className="panel timeline-controls" aria-label="Timeline controls">
        <label>
          Zoom
          <input
            type="range"
            min={0.9}
            max={1.45}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>

        <label>
          Focus
          <select value={focusEra} onChange={(event) => setFocusEra(event.target.value as 'all' | TimelineEra)}>
            <option value="all">All</option>
            <option value="past">Past</option>
            <option value="now">Now</option>
            <option value="future">Future</option>
          </select>
        </label>
      </section>

      <section className="panel timeline-surface" style={{ transform: `scale(${zoom})` }}>
        <div className="time-axis" aria-hidden="true" />
        <svg className="connection-lines" viewBox="0 0 100 280" preserveAspectRatio="none" aria-hidden="true">
          {filteredThreads.flatMap((thread) =>
            thread.linkedTo
              .filter((targetId) => filteredIds.has(targetId))
              .map((targetId) => {
                const from = threadPositions[thread.id];
                const to = threadPositions[targetId];
                if (!from || !to) return null;
                return (
                  <line
                    key={`${thread.id}-${targetId}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="connection-line"
                  />
                );
              }),
          )}
        </svg>
        {(['past', 'now', 'future'] as const).map((era) => (
          <div key={era} className={`time-node ${era}`} style={{ left: `${ERA_META[era].x}%` }}>
            <span>{ERA_META[era].label}</span>
          </div>
        ))}

        {filteredThreads.map((thread, index) => {
          const point = threadPositions[thread.id];
          return (
            <button
              key={thread.id}
              type="button"
              className={`thread-node ${thread.urgency} ${selectedId === thread.id ? 'selected' : ''}`}
              style={{ left: `${point.x}%`, top: `${point.y}px` }}
              onClick={() => setSelectedId(thread.id)}
            >
              {thread.title}
            </button>
          );
        })}
      </section>

      <section className="panel thread-detail-panel" aria-live="polite">
        <h2>{selectedThread.title}</h2>
        <p>{selectedThread.summary}</p>
        <p>{selectedThread.details}</p>
        <p>
          <strong>Timeline:</strong> {ERA_META[selectedThread.era].label} · <strong>Status:</strong>{' '}
          {URGENCY_LABEL[selectedThread.urgency]}
        </p>
        <p>
          <strong>Escalates toward:</strong>{' '}
          {selectedThread.linkedTo.length
            ? selectedThread.linkedTo
                .map((linkedId) => TIMELINE_THREADS.find((candidate) => candidate.id === linkedId)?.title ?? linkedId)
                .join(', ')
            : 'No direct follow-up thread'}
        </p>
      </section>
    </main>
  );
}
