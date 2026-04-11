import { NextRequest, NextResponse } from 'next/server';

import { applyCampaignV2AuthoringAction, type CampaignV2AuthoringAction } from '@/server/campaign-v2';
import { buildCampaignV2InspectorPayload } from '@/server/campaign-v2/board-data';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      action?: string;
      [key: string]: unknown;
    };

    if (typeof body?.projectId !== 'string' || typeof body?.action !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid campaign-v2 authoring payload.',
        },
        {
          status: 400,
        },
      );
    }

    const result = await applyCampaignV2AuthoringAction({
      projectId: body.projectId,
      input: body as CampaignV2AuthoringAction,
    });
    const payload = await buildCampaignV2InspectorPayload({
      projectId: body.projectId,
      requestedProjectId: body.projectId,
      requestedLocationId: result.selectedLocationId ?? undefined,
      contentSubdir: 'campaign-v2',
    });

    return NextResponse.json(
      {
        payload,
        result,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save campaign-v2 authoring change.';
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
