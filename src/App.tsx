import { useEffect, useState } from 'react';
import { ThreadDetailPage } from './features/threads/ThreadDetailPage';
import { ThreadsListPage } from './features/threads/ThreadsListPage';
import { TimelineBoardPage } from './features/timeline/TimelineBoardPage';
import { optimisticNavigate } from './lib/navigation';
import { markInitialLoadEnd, markInitialLoadStart } from './lib/performance';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Route = 'threads' | 'thread-detail' | 'timeline';

export function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('threads');
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    markInitialLoadStart();
    const timer = window.setTimeout(() => {
      markInitialLoadEnd();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const navigate = async (nextRoute: Route): Promise<void> => {
    await optimisticNavigate(
      nextRoute,
      async () => {
        await wait(120);
        setRoute(nextRoute);
      },
      () => setIsNavigating(true),
      () => setIsNavigating(false),
    );
  };

  return (
    <main>
      <nav>
        <button onClick={() => void navigate('threads')}>Threads</button>
        <button onClick={() => void navigate('thread-detail')}>Thread detail</button>
        <button onClick={() => void navigate('timeline')}>Timeline</button>
      </nav>

      {isNavigating && <div aria-live="polite">Navigating...</div>}

      {route === 'threads' && <ThreadsListPage />}
      {route === 'thread-detail' && <ThreadDetailPage threadId="thread-1" />}
      {route === 'timeline' && <TimelineBoardPage />}
    </main>
  );
}
