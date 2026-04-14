import { NextRequest, NextResponse } from 'next/server';

import { buildCampaignV2PlayerCharacterPagePayload } from '@/server/campaign-v2/board-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestedProjectId = request.nextUrl.searchParams.get('project') ?? undefined;

  try {
    const resolvedParams = await params;
    const payload = await buildCampaignV2PlayerCharacterPagePayload({
      projectId: requestedProjectId ?? 'project-3',
      requestedProjectId,
      requestedPlayerCharacterId: resolvedParams.id,
    });

    return NextResponse.json(payload, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the campaign-v2 player character.';
    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
