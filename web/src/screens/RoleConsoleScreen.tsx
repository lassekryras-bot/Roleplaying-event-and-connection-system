import { Badge, Card, Skeleton, Toast, typography } from "../components/ui";

export function RoleConsoleScreen() {
  return (
    <div className="ui-stack">
      <Card>
        <h2 style={typography.headingMd}>GM Console</h2>
        <p style={typography.bodyMd}>Review pacing, scene continuity, and flags from moderators.</p>
        <Badge tone="warning">Paused scene</Badge>
      </Card>

      <Card>
        <h3 style={typography.label}>AI Drafting Queue</h3>
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton height={14} />
      </Card>

      <Toast tone="success">Autosave completed. Last sync: 2 minutes ago.</Toast>
    </div>
  );
}
