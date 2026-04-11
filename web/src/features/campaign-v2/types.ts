import type {
  CampaignV2AuthoringMutation,
  CampaignV2AuthoringPayload,
  CampaignV2GmOverviewPayload,
  CampaignV2PrepPayload,
  CampaignV2MigrationChecklistPayload,
  CampaignV2LocationSummaryViewModel,
  CampaignV2LocationTimelinePayload,
} from '@/server/campaign-v2';

export type CampaignV2ProjectSummary = {
  id: string;
  name: string;
  status: string;
  hasCampaignV2Content: boolean;
  preferredContentSubdir: string | null;
};

export type CampaignV2InspectorCounts = {
  locations: number;
  locationStates: number;
  sessions: number;
  events: number;
  effects: number;
  invalidFiles: number;
};

export type CampaignV2InspectorPayload = {
  project: CampaignV2ProjectSummary | null;
  projects: CampaignV2ProjectSummary[];
  selectedLocationId: string | null;
  locations: CampaignV2LocationSummaryViewModel[];
  overview: CampaignV2GmOverviewPayload | null;
  locationTimeline: CampaignV2LocationTimelinePayload | null;
  prep: CampaignV2PrepPayload | null;
  authoring: CampaignV2AuthoringPayload | null;
  migrationChecklist: CampaignV2MigrationChecklistPayload | null;
  contentSubdir: string | null;
  trustedLocationDualWriteEnabled: boolean;
  counts: CampaignV2InspectorCounts;
  loadedAt: string;
};

export type CampaignV2LocationEditDraft = {
  projectId: string;
  locationId: string;
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

export type CampaignV2LocationDualWriteResponse = {
  payload: CampaignV2InspectorPayload;
  report: CampaignV2DualWriteReport;
};

export type CampaignV2AuthoringResponse = {
  payload: CampaignV2InspectorPayload;
  result: CampaignV2AuthoringMutation;
};
