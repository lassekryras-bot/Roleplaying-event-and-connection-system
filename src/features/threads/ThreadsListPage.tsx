import { useCallback, useEffect, useState } from 'react';
import { fetchWithHandling, withRetryAction } from '../../lib/fetchClient';
import { notifyRefreshSuccess } from '../../lib/toast';

interface ThreadSummary {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'resolved';
}

function ThreadsListSkeleton(): JSX.Element {
  return (
    <ul aria-label="threads-list-skeleton">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="skeleton-row">Loading thread...</li>
      ))}
    </ul>
  );
}

export function ThreadsListPage(): JSX.Element {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await withRetryAction(
        () => fetchWithHandling<ThreadSummary[]>('/api/threads', { endpointName: 'threads list', retries: 2 }),
        () => setError('Could not load thread list. Please retry.'),
      );
      setThreads(payload);
    } catch {
      setError('Could not load thread list. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  if (isLoading) {
    return <ThreadsListSkeleton />;
  }

  return (
    <section>
      <header>
        <h1>Threads</h1>
        <button
          onClick={async () => {
            await loadThreads();
            if (!error) {
              notifyRefreshSuccess('Threads list');
            }
          }}
        >
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void loadThreads()}>Retry</button>
        </div>
      )}

      <ul>
        {threads.map((thread) => (
          <li key={thread.id}>
            <strong>{thread.title}</strong> - {thread.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
