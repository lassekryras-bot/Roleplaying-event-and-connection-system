export type CampaignV2MigrationChecklistItem = {
  key: string;
  title: string;
  status: 'complete' | 'transition' | 'pending';
  detail: string;
};

export type CampaignV2MigrationChecklistPayload = {
  projectId: string;
  contentSubdir: string | null;
  validationCommand: string;
  items: CampaignV2MigrationChecklistItem[];
};

export function buildCampaignV2MigrationChecklist({
  projectId,
  contentSubdir,
}: {
  projectId: string;
  contentSubdir: string | null;
}): CampaignV2MigrationChecklistPayload {
  const validationCommand = `npm run validate:campaign-v2 -- --project ${projectId}`;

  return {
    projectId,
    contentSubdir,
    validationCommand,
    items: [
      {
        key: 'v2-only-writes',
        title: 'V2 is the only write path',
        status: 'complete',
        detail: 'Legacy dual-write is frozen. New authoring flows write campaign-v2 only.',
      },
      {
        key: 'legacy-fallback',
        title: 'Legacy timeline stays available as read-only fallback',
        status: 'transition',
        detail: 'Use `/timeline?surface=classic` only while final campaign confidence is still being built.',
      },
      {
        key: 'campaign-validation',
        title: 'Whole-campaign validation is part of the exit criteria',
        status: 'complete',
        detail: `Run \`${validationCommand}\` before declaring a campaign fully migrated.`,
      },
      {
        key: 'primary-content',
        title: 'Primary campaign-v2 content is present',
        status: contentSubdir === 'campaign-v2' ? 'complete' : 'transition',
        detail:
          contentSubdir === 'campaign-v2'
            ? 'This project is already loading from the primary campaign-v2 dataset.'
            : 'This project is still using fallback or shadow content, so keep the old model archived until primary v2 content is in place.',
      },
      {
        key: 'legacy-code-removal',
        title: 'Delete old code only after a full v2 campaign run',
        status: 'pending',
        detail: 'Do not remove old loaders or converters until load, render, edit, save, and validate all succeed on v2 alone.',
      },
    ],
  };
}
