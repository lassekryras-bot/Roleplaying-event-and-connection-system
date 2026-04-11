import { NextRequest, NextResponse } from 'next/server';

import { updateTrustedLocationIdentityDualWrite } from '@/server/campaign-v2';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      locationId?: string;
      title?: string;
      summary?: string;
      tags?: string[];
    };

    if (
      typeof body?.projectId !== 'string' ||
      typeof body?.locationId !== 'string' ||
      typeof body?.title !== 'string' ||
      typeof body?.summary !== 'string' ||
      !Array.isArray(body?.tags)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid location dual-write payload.',
        },
        {
          status: 400,
        },
      );
    }

    const result = await updateTrustedLocationIdentityDualWrite({
      projectId: body.projectId,
      locationId: body.locationId,
      input: {
        title: body.title,
        summary: body.summary,
        tags: body.tags,
      },
    });

    return NextResponse.json(result, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dual-write location edit.';
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
