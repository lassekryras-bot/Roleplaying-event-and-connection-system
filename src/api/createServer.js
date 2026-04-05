import http from "node:http";

import { sanitizeVisibilityPayloadForRole } from "../visibility/visibilityPolicy.js";
import { filterThreadForRole } from "../visibility/filterThreadForRole.js";
import { sortEventsForTimeline } from "../timeline/sortEvents.js";
import { transitionThreadState } from "../threads/threadStateMachine.js";
import { getWriteEndpoints, requireAccess, resolveRequestContext } from "./accessGuards.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, code, error) {
  sendJson(response, statusCode, { code, error });
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;
    });

    request.on("end", () => {
      if (rawBody.trim().length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });

    request.on("error", (error) => reject(error));
  });
}

export function createServer({
  getThreadById,
  listThreads,
  listProjects,
  listMemberships,
  listEvents,
  saveThreadState,
  createProjectMembership,
  createProjectInvite,
  getProjectMembershipByUserId,
  authenticateUser,
}) {
  if (typeof getThreadById !== "function" || typeof listThreads !== "function") {
    throw new Error("getThreadById and listThreads functions are required");
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const threadDetailMatch = /^\/threads\/([^/]+)$/.exec(url.pathname);
    const projectMembershipMatch = /^\/projects\/([^/]+)\/memberships$/.exec(url.pathname);
    const projectInviteMatch = /^\/projects\/([^/]+)\/invites$/.exec(url.pathname);
    const accessContext = resolveRequestContext(request, { getProjectMembershipByUserId });

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/meta/write-endpoints") {
      sendJson(response, 200, { write_endpoints: getWriteEndpoints() });
      return;
    }


    if (request.method === "POST" && url.pathname === "/auth/login") {
      if (typeof authenticateUser !== "function") {
        sendError(response, 501, "NOT_IMPLEMENTED", "auth endpoint not implemented");
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      const authenticatedUser = authenticateUser(body.username, body.password);
      if (!authenticatedUser) {
        sendError(response, 401, "INVALID_CREDENTIALS", "invalid username or password");
        return;
      }

      sendJson(response, 200, {
        user: {
          id: authenticatedUser.id,
          username: authenticatedUser.username,
          role: authenticatedUser.role,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/threads") {
      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      const threads = listThreads();
      try {
        const filteredThreads = sanitizeVisibilityPayloadForRole(threads, accessContext.role);
        sendJson(response, 200, filteredThreads);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/projects") {
      if (typeof listProjects !== "function") {
        sendError(response, 501, "NOT_IMPLEMENTED", "projects endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      sendJson(response, 200, listProjects());
      return;
    }

    if (request.method === "GET" && url.pathname === "/memberships") {
      if (typeof listMemberships !== "function") {
        sendError(response, 501, "NOT_IMPLEMENTED", "memberships endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      const projectId = url.searchParams.get("project_id") ?? undefined;
      const userId = url.searchParams.get("user_id") ?? undefined;
      const memberships = listMemberships({ projectId, userId });
      sendJson(response, 200, memberships);
      return;
    }

    if (request.method === "POST" && url.pathname === "/invites") {
      if (typeof createProjectInvite !== "function") {
        sendError(response, 501, "NOT_IMPLEMENTED", "invites endpoint not implemented");
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      if (typeof body.project_id !== "string" || body.project_id.trim().length === 0) {
        sendError(response, 400, "PROJECT_ID_REQUIRED", "project_id is required");
        return;
      }

      const projectId = body.project_id.trim();
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      const invite = createProjectInvite(projectId, body);
      sendJson(response, 201, invite);
      return;
    }

    if (request.method === "GET" && url.pathname === "/timeline/events") {
      if (typeof listEvents !== "function") {
        sendJson(response, 501, { error: "timeline endpoint not implemented" });
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      try {
        const timelineEvents = sortEventsForTimeline(listEvents());
        const filteredTimelineEvents = sanitizeVisibilityPayloadForRole(timelineEvents, accessContext.role);
        sendJson(response, 200, filteredTimelineEvents);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    if (request.method === "POST" && projectMembershipMatch) {
      if (typeof createProjectMembership !== "function") {
        sendJson(response, 501, { error: "project membership endpoint not implemented" });
        return;
      }

      const projectId = decodeURIComponent(projectMembershipMatch[1]);
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      const body = await parseJsonBody(request);
      const membership = createProjectMembership(projectId, body);
      sendJson(response, 201, membership);
      return;
    }

    if (request.method === "POST" && projectInviteMatch) {
      if (typeof createProjectInvite !== "function") {
        sendJson(response, 501, { error: "project invite endpoint not implemented" });
        return;
      }

      const projectId = decodeURIComponent(projectInviteMatch[1]);
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "invalid JSON body");
        return;
      }
      const invite = createProjectInvite(projectId, body);
      sendJson(response, 201, invite);
      return;
    }

    if (request.method === "PATCH" && threadDetailMatch) {
      const threadId = decodeURIComponent(threadDetailMatch[1]);
      const currentThread = getThreadById(threadId);

      if (!currentThread) {
        sendJson(response, 404, { error: "thread not found" });
        return;
      }

      if (typeof saveThreadState !== "function") {
        sendJson(response, 501, { error: "thread transition endpoint not implemented" });
        return;
      }

      const guardResult = requireAccess(accessContext, {
        allowRoles: ["GM", "HELPER"],
        projectId: currentThread.project_id,
      });
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      try {
        const body = await parseJsonBody(request);
        const updatedThread = transitionThreadState(currentThread, body.state);
        const persistedThread = saveThreadState(threadId, updatedThread.state);
        sendJson(response, 200, persistedThread);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "INVALID_STATE_TRANSITION" });
        return;
      }
    }

    if (request.method === "GET" && threadDetailMatch) {
      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        sendJson(response, guardResult.status, guardResult.payload);
        return;
      }

      const threadId = decodeURIComponent(threadDetailMatch[1]);
      const thread = getThreadById(threadId);

      if (!thread) {
        sendJson(response, 404, { error: "thread not found" });
        return;
      }

      try {
        const filteredThread = filterThreadForRole(thread, accessContext.role);
        sendJson(response, 200, filteredThread);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    sendJson(response, 404, { error: "not found" });
  });
}
