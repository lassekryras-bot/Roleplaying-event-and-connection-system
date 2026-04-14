import http from "node:http";

import { sanitizeVisibilityPayloadForRole } from "../visibility/visibilityPolicy.js";
import { filterThreadForRole } from "../visibility/filterThreadForRole.js";
import { sortEventsForTimeline } from "../timeline/sortEvents.js";
import { transitionThreadState } from "../threads/threadStateMachine.js";
import { getWriteEndpoints, requireAccess, resolveRequestContext } from "./accessGuards.js";

function sendJson(response, statusCode, payload) {
  const headers = arguments[3] ?? {};
  response.writeHead(statusCode, { ...headers, "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, code, error) {
  const headers = arguments[4] ?? {};
  sendJson(response, statusCode, { code, error }, headers);
}

function createCorsHeaders(request) {
  const requestOrigin = request.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN ?? requestOrigin ?? "*";

  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type, x-role, x-user-id",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
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
  getPreferredProjectIdForUser,
  savePreferredProjectIdForUser,
  getProjectGraph,
  executeProjectCommand,
  getProjectHistory,
  undoProjectHistory,
  redoProjectHistory,
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
    const projectGraphMatch = /^\/projects\/([^/]+)\/graph$/.exec(url.pathname);
    const projectCommandsMatch = /^\/projects\/([^/]+)\/commands$/.exec(url.pathname);
    const projectHistoryMatch = /^\/projects\/([^/]+)\/history$/.exec(url.pathname);
    const projectHistoryUndoMatch = /^\/projects\/([^/]+)\/history\/undo$/.exec(url.pathname);
    const projectHistoryRedoMatch = /^\/projects\/([^/]+)\/history\/redo$/.exec(url.pathname);
    const projectMembershipMatch = /^\/projects\/([^/]+)\/memberships$/.exec(url.pathname);
    const projectInviteMatch = /^\/projects\/([^/]+)\/invites$/.exec(url.pathname);
    const accessContext = resolveRequestContext(request, { getProjectMembershipByUserId });
    const corsHeaders = createCorsHeaders(request);
    const send = (statusCode, payload) => sendJson(response, statusCode, payload, corsHeaders);
    const fail = (statusCode, code, error) => sendError(response, statusCode, code, error, corsHeaders);

    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      send(200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/meta/write-endpoints") {
      send(200, { write_endpoints: getWriteEndpoints() });
      return;
    }


    if (request.method === "POST" && url.pathname === "/auth/login") {
      if (typeof authenticateUser !== "function") {
        fail(501, "NOT_IMPLEMENTED", "auth endpoint not implemented");
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        fail(400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        fail(400, "INVALID_REQUEST", "request body must be a JSON object");
        return;
      }

      if (typeof body.username !== "string" || body.username.trim().length === 0) {
        fail(400, "USERNAME_REQUIRED", "username is required");
        return;
      }

      if (typeof body.password !== "string" || body.password.length === 0) {
        fail(400, "PASSWORD_REQUIRED", "password is required");
        return;
      }

      const authenticatedUser = authenticateUser(body.username, body.password);
      if (!authenticatedUser) {
        fail(401, "INVALID_CREDENTIALS", "invalid username or password");
        return;
      }

      send(200, {
        user_id: authenticatedUser.user_id ?? authenticatedUser.id,
        username: authenticatedUser.username,
        role: authenticatedUser.role,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/threads") {
      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const threads = listThreads({
        role: accessContext.role,
        userId: accessContext.userId,
      });
      try {
        const filteredThreads = sanitizeVisibilityPayloadForRole(threads, accessContext.role);
        send(200, filteredThreads);
        return;
      } catch (error) {
        send(400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/projects") {
      if (typeof listProjects !== "function") {
        fail(501, "NOT_IMPLEMENTED", "projects endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      send(
        200,
        listProjects({
          role: accessContext.role,
          userId: accessContext.userId,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/preferences/selected-project") {
      if (typeof getPreferredProjectIdForUser !== "function") {
        fail(501, "NOT_IMPLEMENTED", "selected project preference endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      if (!accessContext.userId) {
        fail(400, "USER_ID_REQUIRED", "user id is required");
        return;
      }

      const preferredProjectId = getPreferredProjectIdForUser(accessContext.userId);
      const accessibleProjectIds =
        typeof listProjects === "function"
          ? new Set(
              listProjects({
                role: accessContext.role,
                userId: accessContext.userId,
              }).map((project) => project.id),
            )
          : null;

      send(200, {
        project_id:
          typeof preferredProjectId === "string" &&
          preferredProjectId.length > 0 &&
          (!accessibleProjectIds || accessibleProjectIds.has(preferredProjectId))
            ? preferredProjectId
            : null,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/preferences/selected-project") {
      if (typeof savePreferredProjectIdForUser !== "function") {
        fail(501, "NOT_IMPLEMENTED", "selected project preference endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      if (!accessContext.userId) {
        fail(400, "USER_ID_REQUIRED", "user id is required");
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        fail(400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        fail(400, "INVALID_REQUEST", "request body must be a JSON object");
        return;
      }

      if (typeof body.project_id !== "string" || body.project_id.trim().length === 0) {
        fail(400, "PROJECT_ID_REQUIRED", "project_id is required");
        return;
      }

      const projectAccessGuard = requireAccess(accessContext, { projectId: body.project_id.trim() });
      if (!projectAccessGuard.allowed) {
        send(projectAccessGuard.status, projectAccessGuard.payload);
        return;
      }

      try {
        const projectId = savePreferredProjectIdForUser(accessContext.userId, body.project_id.trim());
        send(200, { project_id: projectId });
        return;
      } catch (error) {
        if (sendKnownError(fail, error, "REQUEST_FAILED")) {
          return;
        }

        fail(400, "REQUEST_FAILED", error.message);
        return;
      }
    }

    if (request.method === "GET" && projectGraphMatch) {
      if (typeof getProjectGraph !== "function") {
        fail(501, "NOT_IMPLEMENTED", "project graph endpoint not implemented");
        return;
      }

      const projectId = decodeURIComponent(projectGraphMatch[1]);
      const guardResult = requireAccess(accessContext, { projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const requestedView = url.searchParams.get("view");
      const playerUserId = url.searchParams.get("player_id") ?? undefined;
      if (requestedView && requestedView !== "gm" && requestedView !== "player") {
        fail(400, "INVALID_VIEW", "view must be gm or player");
        return;
      }

      const effectiveView = accessContext.role === "PLAYER" ? "player" : requestedView ?? "gm";
      const graphPayload = getProjectGraph({
        projectId,
        view: effectiveView,
        role: accessContext.role,
        userId: accessContext.userId,
        playerUserId,
      });

      if (!graphPayload) {
        fail(404, "PROJECT_NOT_FOUND", "project not found");
        return;
      }

      send(200, graphPayload);
      return;
    }

    if (request.method === "GET" && projectHistoryMatch) {
      if (typeof getProjectHistory !== "function") {
        fail(501, "NOT_IMPLEMENTED", "project history endpoint not implemented");
        return;
      }

      const projectId = decodeURIComponent(projectHistoryMatch[1]);
      const guardResult = requireAccess(accessContext, { projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const historyPayload = getProjectHistory(projectId);
      if (!historyPayload) {
        fail(404, "PROJECT_NOT_FOUND", "project not found");
        return;
      }

      send(200, historyPayload);
      return;
    }

    if (request.method === "POST" && projectCommandsMatch) {
      if (typeof executeProjectCommand !== "function") {
        fail(501, "NOT_IMPLEMENTED", "project command endpoint not implemented");
        return;
      }

      const projectId = decodeURIComponent(projectCommandsMatch[1]);
      const guardResult = requireAccess(accessContext, { projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        fail(400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.kind !== "string") {
        fail(400, "INVALID_COMMAND", "command body must include a kind");
        return;
      }

      try {
        const result = executeProjectCommand({
          projectId,
          command: body,
          actorRole: accessContext.role,
          actorUserId: accessContext.userId,
        });
        send(200, result);
        return;
      } catch (error) {
        if (sendKnownError(fail, error, "REQUEST_FAILED")) {
          return;
        }

        fail(400, "INVALID_COMMAND", error.message);
        return;
      }
    }

    if (request.method === "POST" && projectHistoryUndoMatch) {
      if (typeof undoProjectHistory !== "function") {
        fail(501, "NOT_IMPLEMENTED", "project undo endpoint not implemented");
        return;
      }

      const projectId = decodeURIComponent(projectHistoryUndoMatch[1]);
      const guardResult = requireAccess(accessContext, { projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      try {
        const result = undoProjectHistory({
          projectId,
          actorRole: accessContext.role,
          actorUserId: accessContext.userId,
        });
        send(200, result);
        return;
      } catch (error) {
        if (sendKnownError(fail, error, "REQUEST_FAILED")) {
          return;
        }

        fail(400, "UNDO_FAILED", error.message);
        return;
      }
    }

    if (request.method === "POST" && projectHistoryRedoMatch) {
      if (typeof redoProjectHistory !== "function") {
        fail(501, "NOT_IMPLEMENTED", "project redo endpoint not implemented");
        return;
      }

      const projectId = decodeURIComponent(projectHistoryRedoMatch[1]);
      const guardResult = requireAccess(accessContext, { projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      try {
        const result = redoProjectHistory({
          projectId,
          actorRole: accessContext.role,
          actorUserId: accessContext.userId,
        });
        send(200, result);
        return;
      } catch (error) {
        if (sendKnownError(fail, error, "REQUEST_FAILED")) {
          return;
        }

        fail(400, "REDO_FAILED", error.message);
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/memberships") {
      if (typeof listMemberships !== "function") {
        fail(501, "NOT_IMPLEMENTED", "memberships endpoint not implemented");
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const projectId = url.searchParams.get("project_id") ?? undefined;
      const userId = url.searchParams.get("user_id") ?? undefined;
      const memberships = listMemberships({ projectId, userId });
      send(200, memberships);
      return;
    }

    if (request.method === "POST" && url.pathname === "/invites") {
      if (typeof createProjectInvite !== "function") {
        fail(501, "NOT_IMPLEMENTED", "invites endpoint not implemented");
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        fail(400, "INVALID_JSON", "invalid JSON body");
        return;
      }

      if (typeof body.project_id !== "string" || body.project_id.trim().length === 0) {
        fail(400, "PROJECT_ID_REQUIRED", "project_id is required");
        return;
      }

      const projectId = body.project_id.trim();
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const invite = createProjectInvite(projectId, body);
      send(201, invite);
      return;
    }

    if (request.method === "GET" && url.pathname === "/timeline/events") {
      if (typeof listEvents !== "function") {
        send(501, { error: "timeline endpoint not implemented" });
        return;
      }

      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      try {
        const timelineEvents = sortEventsForTimeline(
          listEvents({
            role: accessContext.role,
            userId: accessContext.userId,
          }),
        );
        const filteredTimelineEvents = sanitizeVisibilityPayloadForRole(timelineEvents, accessContext.role);
        send(200, filteredTimelineEvents);
        return;
      } catch (error) {
        send(400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    if (request.method === "POST" && projectMembershipMatch) {
      if (typeof createProjectMembership !== "function") {
        send(501, { error: "project membership endpoint not implemented" });
        return;
      }

      const projectId = decodeURIComponent(projectMembershipMatch[1]);
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const body = await parseJsonBody(request);
      const membership = createProjectMembership(projectId, body);
      send(201, membership);
      return;
    }

    if (request.method === "POST" && projectInviteMatch) {
      if (typeof createProjectInvite !== "function") {
        send(501, { error: "project invite endpoint not implemented" });
        return;
      }

      const projectId = decodeURIComponent(projectInviteMatch[1]);
      const guardResult = requireAccess(accessContext, { allowRoles: ["GM", "HELPER"], projectId });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      let body;
      try {
        body = await parseJsonBody(request);
      } catch {
        fail(400, "INVALID_JSON", "invalid JSON body");
        return;
      }
      const invite = createProjectInvite(projectId, body);
      send(201, invite);
      return;
    }

    if (request.method === "PATCH" && threadDetailMatch) {
      const threadId = decodeURIComponent(threadDetailMatch[1]);
      const currentThread = getThreadById(threadId, {
        role: accessContext.role,
        userId: accessContext.userId,
      });

      if (!currentThread) {
        send(404, { error: "thread not found" });
        return;
      }

      if (typeof saveThreadState !== "function") {
        send(501, { error: "thread transition endpoint not implemented" });
        return;
      }

      const guardResult = requireAccess(accessContext, {
        allowRoles: ["GM", "HELPER"],
        projectId: currentThread.project_id,
      });
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      try {
        const body = await parseJsonBody(request);
        const updatedThread = transitionThreadState(currentThread, body.state);
        const persistedThread = saveThreadState(threadId, updatedThread.state, {
          role: accessContext.role,
          userId: accessContext.userId,
        });
        send(200, persistedThread);
        return;
      } catch (error) {
        if (sendKnownError(fail, error, "REQUEST_FAILED")) {
          return;
        }
        send(400, { error: error.message, code: "INVALID_STATE_TRANSITION" });
        return;
      }
    }

    if (request.method === "GET" && threadDetailMatch) {
      const guardResult = requireAccess(accessContext);
      if (!guardResult.allowed) {
        send(guardResult.status, guardResult.payload);
        return;
      }

      const threadId = decodeURIComponent(threadDetailMatch[1]);
      const thread = getThreadById(threadId, {
        role: accessContext.role,
        userId: accessContext.userId,
      });

      if (!thread) {
        send(404, { error: "thread not found" });
        return;
      }

      try {
        const filteredThread = filterThreadForRole(thread, accessContext.role);
        send(200, filteredThread);
        return;
      } catch (error) {
        send(400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    send(404, { error: "not found" });
  });
}

function sendKnownError(fail, error, fallbackCode = "REQUEST_FAILED") {
  if (error && typeof error === "object" && "statusCode" in error) {
    fail(error.statusCode, error.code ?? fallbackCode, error.message ?? "request failed");
    return true;
  }

  return false;
}
