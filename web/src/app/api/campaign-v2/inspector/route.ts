import { NextRequest, NextResponse } from 'next/server';

import { buildCampaignV2InspectorPayload } from '@/server/campaign-v2/board-data';

export async function GET(request: NextRequest) {
  const requestedProjectId = request.nextUrl.searchParams.get('project') ?? undefined;
  const requestedLocationId = request.nextUrl.searchParams.get('location') ?? undefined;

  try {
    const payload = await buildCampaignV2InspectorPayload({
      projectId: requestedProjectId ?? 'project-3',
      requestedProjectId,
      requestedLocationId,
    });

    return NextResponse.json(payload, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load campaign-v2 inspector.';
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
