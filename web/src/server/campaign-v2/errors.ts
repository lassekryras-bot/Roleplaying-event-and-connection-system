export type CampaignV2DiagnosticCode =
  | 'FILE_READ_ERROR'
  | 'JSON_PARSE_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'ID_CONVENTION_ERROR'
  | 'REFERENCE_ERROR';

export type CampaignV2ContentKind = 'relation' | 'location' | 'locationState' | 'session' | 'event' | 'effect';

export type CampaignV2DiagnosticIssue = {
  instancePath: string;
  keyword: string;
  message: string;
};

export type CampaignV2Diagnostic = {
  code: CampaignV2DiagnosticCode;
  contentKind: CampaignV2ContentKind;
  sourceName: string;
  schemaName?: string;
  message: string;
  issues: CampaignV2DiagnosticIssue[];
};

export function formatCampaignV2Diagnostic(diagnostic: CampaignV2Diagnostic): string {
  if (diagnostic.code === 'SCHEMA_VALIDATION_ERROR' && diagnostic.schemaName) {
    const issueSummary =
      diagnostic.issues.length > 0
        ? diagnostic.issues.map((issue) => `${issue.instancePath} ${issue.message}`).join('; ')
        : diagnostic.message;

    return `${diagnostic.sourceName} failed ${diagnostic.schemaName}: ${issueSummary}`;
  }

  return `${diagnostic.sourceName}: ${diagnostic.message}`;
}
