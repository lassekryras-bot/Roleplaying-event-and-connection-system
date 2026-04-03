import type { Meta, StoryObj } from "@storybook/react";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Toast } from "../components/ui";

const meta: Meta = {
  title: "UI/Core Components",
};

export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="ui-stack">
      <Button variant="primary">Primary</Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const FormControls: StoryObj = {
  render: () => (
    <div className="ui-stack" style={{ minWidth: 320 }}>
      <Input placeholder="Thread title" />
      <Select defaultValue="active">
        <option value="draft">Draft</option>
        <option value="active">Active</option>
      </Select>
    </div>
  ),
};

export const SurfacesAndFeedback: StoryObj = {
  render: () => (
    <div className="ui-stack" style={{ minWidth: 360 }}>
      <Card>
        <Badge tone="success">Active</Badge>
      </Card>
      <EmptyState title="No scenes" description="Create a scene to start the session." actionLabel="Create" />
      <Skeleton height={14} />
      <Toast tone="info">A player joined the thread.</Toast>
    </div>
  ),
};
