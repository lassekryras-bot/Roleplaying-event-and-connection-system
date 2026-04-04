import { ThreadState } from "../domain/entities.js";

const VALID_TRANSITIONS = Object.freeze({
  [ThreadState.DORMANT]: new Set([ThreadState.ACTIVE]),
  [ThreadState.ACTIVE]: new Set([ThreadState.ESCALATED, ThreadState.RESOLVED, ThreadState.DORMANT]),
  [ThreadState.ESCALATED]: new Set([ThreadState.ACTIVE, ThreadState.RESOLVED]),
  [ThreadState.RESOLVED]: new Set([ThreadState.ACTIVE]),
});

/**
 * Returns true when a thread can move from one state to the target state.
 *
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canTransitionThreadState(fromState, toState) {
  return VALID_TRANSITIONS[fromState]?.has(toState) ?? false;
}

/**
 * Validate and apply a thread state transition.
 *
 * Guard rules:
 * - dormant -> active only (must be re-activated before escalation/resolution)
 * - active -> escalated|resolved|dormant
 * - escalated -> active|resolved
 * - resolved -> active only (re-open)
 *
 * @param {{state:string}} thread
 * @param {string} targetState
 * @returns {{state:string}}
 */
export function transitionThreadState(thread, targetState) {
  if (!thread || typeof thread !== "object" || Array.isArray(thread)) {
    throw new Error("thread is required");
  }

  if (!Object.values(ThreadState).includes(thread.state)) {
    throw new Error(`Invalid current thread state: ${thread.state}`);
  }

  if (!Object.values(ThreadState).includes(targetState)) {
    throw new Error(`Invalid target thread state: ${targetState}`);
  }

  if (!canTransitionThreadState(thread.state, targetState)) {
    throw new Error(`Invalid thread state transition: ${thread.state} -> ${targetState}`);
  }

  return {
    ...thread,
    state: targetState,
  };
}
