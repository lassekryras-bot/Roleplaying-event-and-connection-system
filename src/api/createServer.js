import http from "node:http";

import { sanitizeVisibilityPayloadForRole } from "../visibility/visibilityPolicy.js";
import { sortEventsForTimeline } from "../timeline/sortEvents.js";

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

export function createServer({ getThreadById, listThreads, listEvents }) {
  if (typeof getThreadById !== "function" || typeof listThreads !== "function") {
    throw new Error("getThreadById and listThreads functions are required");
  }

  return http.createServer((request, response) => {
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
        const filteredThread = sanitizeVisibilityPayloadForRole(thread, role);
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
