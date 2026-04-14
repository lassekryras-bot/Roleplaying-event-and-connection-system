'use client';

import React from 'react';

import { PlayerCharacterDetailPage } from '@/features/campaign-v2-character/PlayerCharacterDetailPage';

export default function PlayerCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  return <PlayerCharacterDetailPage params={params} />;
}
