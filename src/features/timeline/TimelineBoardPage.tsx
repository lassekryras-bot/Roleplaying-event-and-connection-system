import { useCallback, useEffect, useState } from 'react';
import { fetchWithHandling, withRetryAction } from '../../lib/fetchClient';
import { notifyRefreshSuccess, notifyRoleSwitch } from '../../lib/toast';

interface TimelineNode {
  id: string;
  label: string;
  position: 'past' | 'now' | 'future';
}

function TimelineBoardSkeleton(): JSX.Element {
  return (
    <section aria-label="timeline-board-skeleton">
      <p className="skeleton-row">Loading timeline lanes...</p>
      <p className="skeleton-row">Loading events...</p>
    </section>
  );
}

export function TimelineBoardPage(): JSX.Element {
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'gm' | 'player'>('gm');

  const loadTimeline = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await withRetryAction(
        () => fetchWithHandling<TimelineNode[]>('/api/timeline', { endpointName: 'timeline board', retries: 2 }),
        () => setError('Could not load timeline. Please retry.'),
      );
      setNodes(payload);
      return true;
    } catch {
      setError('Could not load timeline. Please retry.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  if (isLoading) {
    return <TimelineBoardSkeleton />;
  }

  return (
    <section>
      <header>
        <h1>Timeline board</h1>
        <button
          onClick={async () => {
            const ok = await loadTimeline();
            if (ok) {
              notifyRefreshSuccess('Timeline board');
            }
          }}
        >
          Refresh
        </button>
        <button
          onClick={() => {
            const nextRole = role === 'gm' ? 'player' : 'gm';
            setRole(nextRole);
            notifyRoleSwitch(nextRole.toUpperCase());
          }}
        >
          Switch role
        </button>
      </header>

      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void loadTimeline()}>Retry</button>
        </div>
      )}

      <ul>
        {nodes.map((node) => (
          <li key={node.id}>
            {node.position.toUpperCase()}: {node.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
