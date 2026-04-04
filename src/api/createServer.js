import http from "node:http";

import { sanitizeVisibilityPayloadForRole } from "../visibility/visibilityPolicy.js";
import { filterThreadForRole } from "../visibility/filterThreadForRole.js";
import { sortEventsForTimeline } from "../timeline/sortEvents.js";
import { transitionThreadState } from "../threads/threadStateMachine.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function normalizeRole(roleHeaderValue) {
  if (typeof roleHeaderValue !== "string") {
    return null;
  }

  const normalizedRole = roleHeaderValue.trim().toUpperCase();
  return normalizedRole.length > 0 ? normalizedRole : null;
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

export function createServer({ getThreadById, listThreads, listEvents, saveThreadState }) {
  if (typeof getThreadById !== "function" || typeof listThreads !== "function") {
    throw new Error("getThreadById and listThreads functions are required");
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const threadDetailMatch = /^\/threads\/([^/]+)$/.exec(url.pathname);
    const role = normalizeRole(request.headers["x-role"]);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/threads") {
      if (!role) {
        sendJson(response, 401, { error: "role header is required" });
        return;
      }

      const threads = listThreads();
      try {
        const filteredThreads = sanitizeVisibilityPayloadForRole(threads, role);
        sendJson(response, 200, filteredThreads);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/timeline/events") {
      if (typeof listEvents !== "function") {
        sendJson(response, 501, { error: "timeline endpoint not implemented" });
        return;
      }

      if (!role) {
        sendJson(response, 401, { error: "role header is required" });
        return;
      }

      try {
        const timelineEvents = sortEventsForTimeline(listEvents());
        const filteredTimelineEvents = sanitizeVisibilityPayloadForRole(timelineEvents, role);
        sendJson(response, 200, filteredTimelineEvents);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message, code: "UNSUPPORTED_ROLE" });
        return;
      }
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
      if (!role) {
        sendJson(response, 401, { error: "role header is required" });
        return;
      }

      const threadId = decodeURIComponent(threadDetailMatch[1]);
      const thread = getThreadById(threadId);

      if (!thread) {
        sendJson(response, 404, { error: "thread not found" });
        return;
      }

      try {
        const filteredThread = filterThreadForRole(thread, role);
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
