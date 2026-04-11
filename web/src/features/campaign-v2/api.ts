import type { CampaignV2AuthoringAction } from '@/server/campaign-v2';

import type {
  CampaignV2AuthoringResponse,
  CampaignV2InspectorPayload,
  CampaignV2LocationDualWriteResponse,
  CampaignV2LocationEditDraft,
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

export async function saveCampaignV2TrustedLocationIdentity(
  draft: CampaignV2LocationEditDraft,
): Promise<CampaignV2LocationDualWriteResponse> {
  const response = await fetch('/api/campaign-v2/dual-write/location', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(draft),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to dual-write location edit (${response.status})`);
  }

  return response.json() as Promise<CampaignV2LocationDualWriteResponse>;
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
