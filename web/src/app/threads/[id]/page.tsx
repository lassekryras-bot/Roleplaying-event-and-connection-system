'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { ThreadDetail } from '@/lib/api';
import { canViewGmContent } from '@/lib/roles';
import { useApiClient } from '@/lib/use-api-client';

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { getThreadById, role } = useApiClient();
  const [threadId, setThreadId] = useState<string>('');
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string>('');

  const canSeeGmTruth = canViewGmContent(role);

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
    <section className="page-section">
      <h1 className="page-title">Thread: {threadId || 'loading...'}</h1>
      <p className="page-subtitle">Thread details, visibility, and message summary.</p>

      {error && <p className="error-text">{error}</p>}

      {thread && (
        <article className="card stack">
          <h2>{thread.title}</h2>
          {thread.player_summary ? <p>{thread.player_summary}</p> : null}
          {canSeeGmTruth && thread.gm_truth ? (
            <div className="card stack">
              <strong>GM Truth</strong>
              <p>{thread.gm_truth}</p>
            </div>
          ) : null}
          <p className="meta-text">Messages: {thread.messages?.length ?? 0}</p>
        </article>
      )}
    </section>
  );
}
