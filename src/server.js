import { createServer } from "./api/createServer.js";
import {
  createInvite,
  createMembership,
  getMembershipByProjectAndUser,
  listMemberships,
  listProjects,
  getThreadById,
  listEvents,
  listThreads,
  updateThreadState,
} from "./data/inMemoryStore.js";
import { authenticateUser } from "./data/inMemoryAuthStore.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer({
  getThreadById,
  listThreads,
  listProjects,
  listMemberships,
  listEvents,
  saveThreadState: updateThreadState,
  createProjectMembership: createMembership,
  createProjectInvite: createInvite,
  getProjectMembershipByUserId: getMembershipByProjectAndUser,
  authenticateUser,
});

server.listen(port, () => {
  console.log(`Living Campaign Engine MVP API listening on http://localhost:${port}`);
});
