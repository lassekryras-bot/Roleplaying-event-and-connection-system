'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThreadSummary } from '@/lib/api';
import { toUiThreadStatus } from '@/lib/thread-state';
import { useApiClient } from '@/lib/use-api-client';

export default function ThreadsPage() {
  const { getThreads } = useApiClient();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getThreads()
      .then((data) => setThreads(data))
      .catch((err: Error) => setError(err.message));
  }, [getThreads]);

  return (
    <section className="page-section">
      <h1 className="page-title">Threads</h1>
      <p className="page-subtitle">Track conversation context and current state.</p>

      {error && <p className="error-text">{error}</p>}

      <ul className="card-list">
        {threads.map((thread) => (
          <li key={thread.id} className="card stack">
            <div className="row-between">
              <Link href={`/threads/${thread.id}`}>{thread.title || thread.id}</Link>
              <span className="status-text">{toUiThreadStatus(thread.state)}</span>
            </div>
            <p className="meta-text">Thread ID: {thread.id}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
