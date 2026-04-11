export type GmTimelineDiagnosticCode =
  | 'FILE_READ_ERROR'
  | 'JSON_PARSE_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'REFERENCE_ERROR';

export type GmTimelineContentKind =
  | 'timeline'
  | 'session'
  | 'place'
  | 'hook'
  | 'threadRef'
  | 'sessionIndex'
  | 'placeIndex'
  | 'hookIndex'
  | 'threadIndex';

export type GmTimelineDiagnosticIssue = {
  instancePath: string;
  keyword: string;
  message: string;
};

export type GmTimelineDiagnostic = {
  code: GmTimelineDiagnosticCode;
  projectId: string;
  contentKind: GmTimelineContentKind;
  relativePath: string;
  schemaName?: string;
  message: string;
  issues?: GmTimelineDiagnosticIssue[];
};

export function formatGmTimelineDiagnostic(diagnostic: GmTimelineDiagnostic): string {
  if (diagnostic.code === 'SCHEMA_VALIDATION_ERROR' && diagnostic.schemaName) {
    const issues = diagnostic.issues ?? [];
    const issueSummary =
      issues.length > 0
        ? issues
            .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
            .join('; ')
        : diagnostic.message;

    return `${diagnostic.relativePath} failed ${diagnostic.schemaName}: ${issueSummary}`;
  }

  return `${diagnostic.relativePath}: ${diagnostic.message}`;
}
