import http from "node:http";

import { filterThreadForRole } from "../visibility/filterThreadForRole.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function createServer({ getThreadById }) {
  if (typeof getThreadById !== "function") {
    throw new Error("getThreadById function is required");
  }

  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const threadDetailMatch = /^\/threads\/([^/]+)$/.exec(url.pathname);

    if (request.method === "GET" && threadDetailMatch) {
      const role = request.headers["x-role"];
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
