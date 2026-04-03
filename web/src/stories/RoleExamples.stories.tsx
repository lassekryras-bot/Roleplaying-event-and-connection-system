import type { Meta, StoryObj } from "@storybook/react";
import { Badge, Button, Card, Toast } from "../components/ui";

const meta: Meta = {
  title: "UI/Role-based Examples",
};

export default meta;

export const PlayerView: StoryObj = {
  render: () => (
    <Card>
      <div className="ui-stack">
        <h3>Player Thread Panel</h3>
        <Badge tone="info">Awaiting GM response</Badge>
        <Button variant="primary">Submit action</Button>
      </div>
    </Card>
  ),
};

export const ModeratorView: StoryObj = {
  render: () => (
    <Card>
      <div className="ui-stack">
        <h3>Moderator Incident Queue</h3>
        <Badge tone="warning">Escalated content</Badge>
        <Button>Review transcript</Button>
      </div>
    </Card>
  ),
};

export const GameMasterView: StoryObj = {
  render: () => (
    <Card>
      <div className="ui-stack">
        <h3>Game Master Control</h3>
        <Badge tone="success">Session healthy</Badge>
        <Toast tone="success">Scene pacing recommendations updated.</Toast>
      </div>
    </Card>
  ),
};
