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
    <section>
      <h1>Threads</h1>
      {error && <p>{error}</p>}
      <ul className="card-list">
        {threads.map((thread) => (
          <li key={thread.id} className="card">
            <Link href={`/threads/${thread.id}`}>{thread.title || thread.id}</Link>
            <span> — {toUiThreadStatus(thread.state)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
