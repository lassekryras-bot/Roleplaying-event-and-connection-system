import { NextRequest, NextResponse } from 'next/server';

import { buildGmTimelineBoardPayload } from '@/server/gm-timeline/board-data';

export async function GET(request: NextRequest) {
  const requestedProjectId = request.nextUrl.searchParams.get('project') ?? undefined;

  try {
    const payload = await buildGmTimelineBoardPayload({
      projectId: requestedProjectId ?? 'project-3',
      requestedProjectId,
    });

    return NextResponse.json(payload, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load GM timeline board.';
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
