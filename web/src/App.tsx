import { ThreadInboxScreen } from "./screens/ThreadInboxScreen";
import { RoleConsoleScreen } from "./screens/RoleConsoleScreen";

export default function App() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <ThreadInboxScreen />
      <div style={{ height: 24 }} />
      <RoleConsoleScreen />
    </main>
  );
}
