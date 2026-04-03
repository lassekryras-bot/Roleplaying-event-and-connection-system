import { MembershipRole } from "../domain/entities.js";

/**
 * Returns a thread payload that is safe for the caller's role.
 *
 * @param {object} thread
 * @param {string} role
 * @returns {object}
 */
export function filterThreadForRole(thread, role) {
  if (!thread) {
    throw new Error("thread is required");
  }

  if (!role) {
    throw new Error("role is required");
  }

  if (role === MembershipRole.GM || role === MembershipRole.HELPER_GM) {
    return { ...thread };
  }

  if (role === MembershipRole.PLAYER) {
    const { gm_truth: _hidden, ...safeThread } = thread;
    return safeThread;
  }

  throw new Error(`Unsupported role: ${role}`);
}
