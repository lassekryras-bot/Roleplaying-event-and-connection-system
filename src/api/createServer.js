import http from "node:http";

import { filterThreadForRole } from "../visibility/filterThreadForRole.js";
import { sortEventsForTimeline } from "../timeline/sortEvents.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function createServer({ getThreadById, listThreads, listEvents }) {
  if (typeof getThreadById !== "function" || typeof listThreads !== "function") {
    throw new Error("getThreadById and listThreads functions are required");
  }

  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const threadDetailMatch = /^\/threads\/([^/]+)$/.exec(url.pathname);
    const role = request.headers["x-role"];

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/threads") {
      const threads = listThreads();
      try {
        const filteredThreads = threads.map((thread) => filterThreadForRole(thread, role));
        sendJson(response, 200, filteredThreads);
        return;
      } catch (error) {
        sendJson(response, 400, { error: error.message });
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/timeline/events") {
      if (typeof listEvents !== "function") {
        sendJson(response, 501, { error: "timeline endpoint not implemented" });
        return;
      }

      const timelineEvents = sortEventsForTimeline(listEvents());
      sendJson(response, 200, timelineEvents);
      return;
    }

    if (request.method === "GET" && threadDetailMatch) {
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
        sendJson(response, 400, { error: error.message });
        return;
      }
    }

    sendJson(response, 404, { error: "not found" });
  });
}
