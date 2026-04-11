import type { GmTimelineBoardPayload } from './types';

export async function fetchGmTimelineBoard(projectId?: string): Promise<GmTimelineBoardPayload> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set('project', projectId);
  }

  const response = await fetch(`/api/gm-timeline${params.size > 0 ? `?${params.toString()}` : ''}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load GM timeline board (${response.status})`);
  }

  return response.json() as Promise<GmTimelineBoardPayload>;
}
