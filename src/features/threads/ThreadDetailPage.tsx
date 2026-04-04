import { useCallback, useEffect, useState } from 'react';
import { fetchWithHandling, withRetryAction } from '../../lib/fetchClient';
import { notifyRefreshSuccess } from '../../lib/toast';

interface ThreadDetail {
  id: string;
  title: string;
  hook: string;
  state: string;
  playerSummary: string;
}

function ThreadDetailSkeleton(): JSX.Element {
  return (
    <article aria-label="thread-detail-skeleton">
      <p className="skeleton-row">Loading title...</p>
      <p className="skeleton-row">Loading state...</p>
      <p className="skeleton-row">Loading summary...</p>
    </article>
  );
}

export function ThreadDetailPage({ threadId }: { threadId: string }): JSX.Element {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await withRetryAction(
        () => fetchWithHandling<ThreadDetail>(`/api/threads/${threadId}`, { endpointName: 'thread detail', retries: 2 }),
        () => setError('Could not load thread detail. Please retry.'),
      );

      setThread(payload);
      return true;
    } catch {
      setError('Could not load thread detail. Please retry.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  if (isLoading) {
    return <ThreadDetailSkeleton />;
  }

  return (
    <section>
      <header>
        <h1>Thread detail</h1>
        <button
          onClick={async () => {
            const ok = await loadThread();
            if (ok) {
              notifyRefreshSuccess('Thread detail');
            }
          }}
        >
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void loadThread()}>Retry</button>
        </div>
      )}

      {thread && (
        <article>
          <h2>{thread.title}</h2>
          <p>{thread.hook}</p>
          <p>State: {thread.state}</p>
          <p>{thread.playerSummary}</p>
        </article>
      )}
    </section>
  );
}
