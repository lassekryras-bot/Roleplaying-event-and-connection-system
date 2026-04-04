'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { ThreadDetail } from '@/lib/api';
import { useApiClient } from '@/lib/use-api-client';

function isPrivilegedRole(role: string) {
  const normalizedRole = role.trim().toUpperCase();
  return normalizedRole === 'GM' || normalizedRole === 'HELPER_GM';
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { getThreadById, role } = useApiClient();
  const [threadId, setThreadId] = useState<string>('');
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string>('');

  const canSeeGmTruth = isPrivilegedRole(role);

  useEffect(() => {
    let active = true;

    Promise.resolve(params)
      .then((resolvedParams) => {
        if (!active) return;
        setThreadId(resolvedParams.id);
        return getThreadById(resolvedParams.id)
          .then((data) => {
            if (active) {
              setThread(data);
            }
          })
          .catch((err: Error) => {
            if (active) {
              setError(err.message);
            }
          });
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, [getThreadById, params]);

  return (
    <section>
      <h1>Thread: {threadId || 'loading...'}</h1>
      {error && <p>{error}</p>}
      {thread && (
        <article className="card">
          <h2>{thread.title}</h2>
          {thread.player_summary ? <p>{thread.player_summary}</p> : null}
          {canSeeGmTruth && thread.gm_truth ? <p>GM Truth: {thread.gm_truth}</p> : null}
          <p>Messages: {thread.messages?.length ?? 0}</p>
        </article>
      )}
    </section>
  );
}
