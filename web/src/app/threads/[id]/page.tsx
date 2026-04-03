'use client';

import { useEffect, useState } from 'react';
import { ThreadDetail } from '@/lib/api';
import { useApiClient } from '@/lib/use-api-client';

export default function ThreadDetailPage({ params }: { params: { id: string } }) {
  const { getThreadById } = useApiClient();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getThreadById(params.id)
      .then((data) => setThread(data))
      .catch((err: Error) => setError(err.message));
  }, [getThreadById, params.id]);

  return (
    <section>
      <h1>Thread: {params.id}</h1>
      {error && <p>{error}</p>}
      {thread && (
        <article className="card">
          <h2>{thread.title}</h2>
          <p>Messages: {thread.messages?.length ?? 0}</p>
        </article>
      )}
    </section>
  );
}
