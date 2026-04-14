import type {
  CampaignV2AuthoringMutation,
  CampaignV2AuthoringPayload,
  CampaignV2GmOverviewPayload,
  CampaignV2PrepPayload,
  CampaignV2LocationSummaryViewModel,
  CampaignV2LocationTimelinePayload,
  CampaignV2PlayerCharacterDetailPayload,
  CampaignV2PlayerCharacterSummaryViewModel,
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
  contentSubdir: string | null;
  counts: CampaignV2InspectorCounts;
  loadedAt: string;
};

export type CampaignV2PlayerCharacterPagePayload = {
  project: CampaignV2ProjectSummary | null;
  projects: CampaignV2ProjectSummary[];
  selectedPlayerCharacterId: string | null;
  playerCharacters: CampaignV2PlayerCharacterSummaryViewModel[];
  detail: CampaignV2PlayerCharacterDetailPayload | null;
  contentSubdir: string | null;
  loadedAt: string;
};

export type CampaignV2AuthoringResponse = {
  payload: CampaignV2InspectorPayload;
  result: CampaignV2AuthoringMutation;
};
