const threads = [
  {
    id: "thread-1",
    project_id: "project-1",
    title: "Whispers in the harbor",
    state: "active",
    gm_truth: "The harbor master is secretly paid by the antagonist.",
    player_summary: "Dockworkers have gone missing at night.",
  },
  {
    id: "thread-2",
    project_id: "project-1",
    title: "Ashes in the chapel",
    state: "dormant",
    gm_truth: "A relic was swapped by a cult insider.",
    player_summary: "The chapel is closed after a suspicious fire.",
  },
];

const projects = [
  {
    id: "project-1",
    name: "Harbor of Whispers",
    status: "active",
  },
];

const memberships = [
  { project_id: "project-1", user_id: "gm-1", role: "GM", status: "active" },
  { project_id: "project-1", user_id: "helper-1", role: "HELPER", status: "active" },
  { project_id: "project-1", user_id: "player-1", role: "PLAYER", status: "active" },
  { project_id: "project-1", user_id: "player-2", role: "PLAYER", status: "active" },
  { project_id: "project-1", user_id: "player-3", role: "PLAYER", status: "active" },
];

const invites = [];
const projectPreferencesByUserId = new Map();

const events = [
  {
    id: "event-1",
    title: "Dock strike begins",
    timeline_position: "past",
    sequence: 10,
  },
  {
    id: "event-2",
    title: "Night watch vanishes",
    timeline_position: "now",
    sequence: 20,
  },
  {
    id: "event-3",
    title: "Harbor riots spread",
    timeline_position: "future_possible",
    sequence: 30,
  },
];

export function getThreadById(threadId) {
  return threads.find((thread) => thread.id === threadId);
}

export function listThreads() {
  return threads.map((thread) => ({ ...thread }));
}

export function listProjects() {
  return projects.map((project) => ({ ...project }));
}

export function listEvents() {
  return events.map((event) => ({ ...event }));
}

export function listMemberships({ projectId, userId } = {}) {
  return memberships
    .filter((membership) => {
      if (projectId && membership.project_id !== projectId) {
        return false;
      }
      if (userId && membership.user_id !== userId) {
        return false;
      }
      return true;
    })
    .map((membership) => ({ ...membership }));
}

export function updateThreadState(threadId, newState) {
  const thread = threads.find((entry) => entry.id === threadId);

  if (!thread) {
    return null;
  }

  thread.state = newState;
  return { ...thread };
}

export function createMembership(projectId, data) {
  const membership = {
    project_id: projectId,
    user_id: data.user_id,
    role: data.role,
    status: "active",
  };

  memberships.push(membership);
  return { ...membership };
}

export function createInvite(projectId, data) {
  const invite = {
    id: `invite-${invites.length + 1}`,
    project_id: projectId,
    email: data.email,
    role: data.role,
  };

  invites.push(invite);
  return { ...invite };
}

export function getMembershipByProjectAndUser(projectId, userId) {
  return memberships.find((membership) => membership.project_id === projectId && membership.user_id === userId) ?? null;
}

export function getPreferredProjectIdForUser(userId) {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return projectPreferencesByUserId.get(userId) ?? null;
}

export function savePreferredProjectIdForUser(userId, projectId) {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    error.code = "USER_ID_REQUIRED";
    throw error;
  }

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    const error = new Error("projectId is required");
    error.statusCode = 400;
    error.code = "PROJECT_ID_REQUIRED";
    throw error;
  }

  projectPreferencesByUserId.set(userId.trim(), projectId.trim());
  return projectId.trim();
}
