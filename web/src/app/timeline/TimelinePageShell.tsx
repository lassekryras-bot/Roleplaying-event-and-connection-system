'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

import { CampaignV2Inspector } from '@/features/campaign-v2/CampaignV2Inspector';
import { GMTimelineBoard } from '@/features/gm-timeline/GMTimelineBoard';

export function TimelinePageShell() {
  const searchParams = useSearchParams();
  const surface = searchParams.get('surface');

  if (surface === 'classic') {
    return (
      <>
        <section
          style={{
            margin: '1rem',
            padding: '0.9rem 1rem',
            borderRadius: '0.9rem',
            border: '1px solid rgba(194, 117, 58, 0.24)',
            background: 'rgba(194, 117, 58, 0.12)',
            color: '#f7efe5',
          }}
          data-testid="legacy-timeline-fallback-banner"
        >
          Legacy timeline fallback is now read-only transition support. Campaign-v2 is the default surface and only write path.
        </section>
        <GMTimelineBoard />
      </>
    );
  }

  return <CampaignV2Inspector />;
}
