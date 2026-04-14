import type { CampaignV2AuthoringAction } from '@/server/campaign-v2';

import type {
  CampaignV2AuthoringResponse,
  CampaignV2InspectorPayload,
  CampaignV2PlayerCharacterPagePayload,
} from './types';

export async function fetchCampaignV2Inspector(projectId?: string, locationId?: string): Promise<CampaignV2InspectorPayload> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set('project', projectId);
  }

  if (locationId) {
    params.set('location', locationId);
  }

  const response = await fetch(`/api/campaign-v2/inspector${params.size > 0 ? `?${params.toString()}` : ''}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load campaign-v2 inspector (${response.status})`);
  }

  return response.json() as Promise<CampaignV2InspectorPayload>;
}

export async function runCampaignV2AuthoringAction(
  projectId: string,
  input: CampaignV2AuthoringAction,
): Promise<CampaignV2AuthoringResponse> {
  const response = await fetch('/api/campaign-v2/authoring', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      ...input,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to save campaign-v2 authoring change (${response.status})`);
  }

  return response.json() as Promise<CampaignV2AuthoringResponse>;
}

export async function fetchCampaignV2PlayerCharacter(
  playerCharacterId: string,
  projectId?: string,
): Promise<CampaignV2PlayerCharacterPagePayload> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set('project', projectId);
  }

  const response = await fetch(
    `/api/campaign-v2/player-characters/${encodeURIComponent(playerCharacterId)}${params.size > 0 ? `?${params.toString()}` : ''}`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to load campaign-v2 player character (${response.status})`);
  }

  return response.json() as Promise<CampaignV2PlayerCharacterPagePayload>;
}
