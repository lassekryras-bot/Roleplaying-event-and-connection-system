import type { CampaignV2InspectorPayload } from '@/features/campaign-v2/types';

import { buildCampaignV2InspectorPayload } from './board-data';
import { resolveCampaignV2Paths, type CampaignV2StorageOptions } from './storage';

export type CampaignV2LocationIdentityInput = {
  title: string;
  summary: string;
  tags: string[];
};

export type CampaignV2DualWriteChannelResult = {
  model: 'old' | 'new';
  targetId: string;
  relativePath: string | null;
  success: boolean;
  message: string;
  data: {
    title: string;
    summary: string;
    tags: string[];
  } | null;
};

export type CampaignV2DualWriteReport = {
  flow: 'trusted-location-identity';
  projectId: string;
  locationId: string;
  placeId: string;
  success: boolean;
  divergence: boolean;
  divergenceReasons: string[];
  oldWrite: CampaignV2DualWriteChannelResult;
  newWrite: CampaignV2DualWriteChannelResult;
};

export type CampaignV2LocationDualWriteResult = {
  payload: CampaignV2InspectorPayload;
  report: CampaignV2DualWriteReport;
};

function mapLocationIdToPlaceId(locationId: string) {
  return locationId.replace(/^location-/, 'place-');
}

function createBlockedReport({
  projectId,
  locationId,
  placeId,
  reason,
}: {
  projectId: string;
  locationId: string;
  placeId: string;
  reason: string;
}): CampaignV2DualWriteReport {
  return {
    flow: 'trusted-location-identity',
    projectId,
    locationId,
    placeId,
    success: false,
    divergence: true,
    divergenceReasons: [reason],
    oldWrite: {
      model: 'old',
      targetId: placeId,
      relativePath: null,
      success: false,
      message: reason,
      data: null,
    },
    newWrite: {
      model: 'new',
      targetId: locationId,
      relativePath: null,
      success: false,
      message: reason,
      data: null,
    },
  };
}

function logDualWriteReport(report: CampaignV2DualWriteReport) {
  const logger = report.success && !report.divergence ? console.info : console.warn;
  logger('[campaign-v2 dual-write]', JSON.stringify(report));
}

export async function updateTrustedLocationIdentityDualWrite(
  options: CampaignV2StorageOptions & {
    locationId: string;
    input: CampaignV2LocationIdentityInput;
  },
): Promise<CampaignV2LocationDualWriteResult> {
  const resolvedCampaignV2Paths = resolveCampaignV2Paths(options);
  const placeId = mapLocationIdToPlaceId(options.locationId);
  const report = createBlockedReport({
    projectId: options.projectId,
    locationId: options.locationId,
    placeId,
    reason: 'Legacy dual-write is frozen. Use the guided campaign-v2 authoring flow instead.',
  });
  logDualWriteReport(report);

  return {
    payload: await buildCampaignV2InspectorPayload({
      campaignsRoot: resolvedCampaignV2Paths.campaignsRoot,
      schemaRoot: resolvedCampaignV2Paths.schemaRoot,
      projectId: options.projectId,
      requestedProjectId: options.projectId,
      requestedLocationId: options.locationId,
    }),
    report,
  };
}
