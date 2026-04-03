import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  threadStateBadgeMap,
  type ThreadState,
} from "../components/ui";

const threads: { id: string; title: string; state: ThreadState }[] = [
  { id: "thr-120", title: "Heist in the Obsidian District", state: "active" },
  { id: "thr-121", title: "Council Negotiation Prep", state: "pending" },
  { id: "thr-122", title: "Night Watch Incident", state: "error" },
];

export function ThreadInboxScreen() {
  return (
    <div className="ui-stack">
      <Card>
        <div className="ui-stack">
          <h2>Thread Inbox</h2>
          <Input placeholder="Search threads" />
          <Select defaultValue="all">
            <option value="all">All states</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="error">Needs attention</option>
          </Select>
        </div>
      </Card>

      {threads.map((thread) => {
        const state = threadStateBadgeMap[thread.state];
        return (
          <Card key={thread.id}>
            <div className="ui-stack">
              <div>{thread.title}</div>
              <Badge tone={state.tone}>{state.label}</Badge>
              <Button variant="primary">Open thread</Button>
            </div>
          </Card>
        );
      })}

      <EmptyState
        title="No archived threads"
        description="Move finished roleplay threads to archive to keep your inbox focused."
        actionLabel="Create thread"
      />
    </div>
  );
}
