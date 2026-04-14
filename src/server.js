import { createServer } from "./api/createServer.js";
import { createFileCampaignStore } from "./data/fileCampaignStore.js";
import { authenticateUser } from "./data/inMemoryAuthStore.js";

const port = Number(process.env.PORT ?? 3001);
const campaignStore = createFileCampaignStore();

const server = createServer({
  getThreadById: campaignStore.getThreadById,
  listThreads: campaignStore.listThreads,
  listProjects: campaignStore.listProjects,
  getPreferredProjectIdForUser: campaignStore.getPreferredProjectIdForUser,
  savePreferredProjectIdForUser: campaignStore.savePreferredProjectIdForUser,
  getProjectGraph: campaignStore.getProjectGraph,
  executeProjectCommand: campaignStore.executeProjectCommand,
  getProjectHistory: campaignStore.getProjectHistory,
  undoProjectHistory: campaignStore.undoProjectHistory,
  redoProjectHistory: campaignStore.redoProjectHistory,
  listMemberships: campaignStore.listMemberships,
  listEvents: campaignStore.listEvents,
  saveThreadState: campaignStore.saveThreadState,
  createProjectMembership: campaignStore.createMembership,
  createProjectInvite: campaignStore.createInvite,
  getProjectMembershipByUserId: campaignStore.getProjectMembershipByUserId,
  authenticateUser,
});

server.listen(port, () => {
  console.log(`Living Campaign Engine MVP API listening on http://localhost:${port}`);
});
