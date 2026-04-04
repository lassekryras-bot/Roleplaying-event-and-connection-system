import { sanitizeVisibilityPayloadForRole } from "./visibilityPolicy.js";

/**
 * Returns a thread payload that is safe for the caller's role.
 *
 * @param {object} thread
 * @param {string} role
 * @returns {object}
 */
export function filterThreadForRole(thread, role) {
  if (!thread || typeof thread !== "object" || Array.isArray(thread)) {
    throw new Error("thread is required");
  }

  return sanitizeVisibilityPayloadForRole(thread, role);
}
