import React from 'react';
import { redirect } from 'next/navigation';

import { buildCampaignV2PlayerCharacterPagePayload } from '@/server/campaign-v2/board-data';

export default async function PlayerCharactersIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedProjectId = resolvedSearchParams.project;
  const payload = await buildCampaignV2PlayerCharacterPagePayload({
    projectId: requestedProjectId ?? 'project-3',
    requestedProjectId,
  });

  if (payload.selectedPlayerCharacterId) {
    const params = new URLSearchParams();
    if (payload.project?.id) {
      params.set('project', payload.project.id);
    }

    redirect(
      `/player-characters/${encodeURIComponent(payload.selectedPlayerCharacterId)}${
        params.size > 0 ? `?${params.toString()}` : ''
      }`,
    );
  }

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '3rem 1.5rem',
      }}
    >
      <div
        style={{
          width: 'min(42rem, 100%)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: '#fffdf8',
          padding: '2rem',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c5e10' }}>
          Player Characters
        </p>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.8rem', color: '#1f2937' }}>No v2 player characters found</h1>
        <p style={{ margin: '0.9rem 0 0', color: '#4b5563', lineHeight: 1.6 }}>
          This project does not have any `playerCharacter` documents yet, so there is nothing to open from the character
          reference route.
        </p>
      </div>
    </section>
  );
}
