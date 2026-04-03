'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Role, THREADS, ThreadState } from '@/lib/data';

type SortOption = 'state' | 'title';

const stateOrder: Record<ThreadState, number> = {
  dormant: 0,
  active: 1,
  escalated: 2,
  resolved: 3,
};

const LIST_STATE_KEY = 'threads:list-ui';

export default function ThreadListClient() {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | ThreadState>('all');
  const [sortBy, setSortBy] = useState<SortOption>('state');
  const [role, setRole] = useState<Role>('PLAYER');

  useEffect(() => {
    const raw = sessionStorage.getItem(LIST_STATE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        query: string;
        stateFilter: 'all' | ThreadState;
        sortBy: SortOption;
        role: Role;
        scrollY: number;
      };
      setQuery(saved.query);
      setStateFilter(saved.stateFilter);
      setSortBy(saved.sortBy);
      setRole(saved.role);
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved.scrollY ?? 0, behavior: 'auto' });
      });
    } catch {
      sessionStorage.removeItem(LIST_STATE_KEY);
    }
  }, []);

  const visibleThreads = useMemo(() => {
    return THREADS.filter((thread) => {
      const matchesQuery = `${thread.title} ${thread.summary}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesState = stateFilter === 'all' ? true : thread.state === stateFilter;
      return matchesQuery && matchesState;
    }).sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return stateOrder[a.state] - stateOrder[b.state] || a.title.localeCompare(b.title);
    });
  }, [query, sortBy, stateFilter]);

  const persistListState = () => {
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({ query, stateFilter, sortBy, role, scrollY: window.scrollY }),
    );
  };

  return (
    <main className="page">
      <h1>Threads</h1>
      <section className="controls" aria-label="Thread controls">
        <label>
          Search title/summary
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads..."
          />
        </label>

        <label>
          State filter
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as 'all' | ThreadState)}
          >
            <option value="all">All</option>
            <option value="dormant">dormant</option>
            <option value="active">active</option>
            <option value="escalated">escalated</option>
            <option value="resolved">resolved</option>
          </select>
        </label>

        <label>
          Sort by
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
            <option value="state">state</option>
            <option value="title">title</option>
          </select>
        </label>

        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="PLAYER">Player</option>
            <option value="GM">GM</option>
            <option value="HELPER_GM">HELPER_GM</option>
          </select>
        </label>
      </section>

      <section className="thread-list" aria-live="polite">
        {visibleThreads.map((thread) => (
          <article key={thread.id} className="thread-card">
            <div className="card-header">
              <h2>{thread.title}</h2>
              <span className={`badge ${thread.state}`}>{thread.state}</span>
            </div>
            <p className="summary">{thread.summary}</p>
            <p className="role-indicator">
              {role === 'PLAYER' ? 'GM-only fields hidden' : 'Full thread details visible'}
            </p>
            <Link
              href={`/threads/${thread.id}?role=${role}`}
              onClick={persistListState}
              className="detail-link"
            >
              Open thread
            </Link>
          </article>
        ))}
        {visibleThreads.length === 0 && <p>No threads match your filters.</p>}
      </section>
    </main>
  );
}
