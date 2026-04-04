import { TimelinePosition } from "../domain/entities.js";

const TIMELINE_ORDER = Object.freeze({
  [TimelinePosition.PAST]: 0,
  now: 1,
  current: 1,
  [TimelinePosition.NOW]: 1,
  [TimelinePosition.FUTURE_POSSIBLE]: 2,
  future: 2,
});

function toTimelineBucket(position) {
  return TIMELINE_ORDER[position] ?? Number.MAX_SAFE_INTEGER;
}

function toTimestampValue(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

/**
 * Deterministically sort timeline entries into:
 * 1) past, 2) current/now, 3) future.
 *
 * Within each segment we apply deterministic tie-breakers in this order:
 *   a) timestamp (`occurred_at` or `scheduled_for`) ascending
 *   b) `sequence` ascending
 *   c) `id` lexicographically ascending
 *
 * Unknown timeline positions are always placed last.
 *
 * @param {Array<{id?:string,timeline_position:string,occurred_at?:string,scheduled_for?:string,sequence?:number}>} events
 * @returns {Array}
 */
export function sortEventsForTimeline(events) {
  if (!Array.isArray(events)) {
    throw new Error("events must be an array");
  }

  return [...events].sort((a, b) => {
    if (!a || !b || typeof a !== "object" || typeof b !== "object") {
      throw new Error("each event must be an object");
    }

    const positionDiff = toTimelineBucket(a.timeline_position) - toTimelineBucket(b.timeline_position);
    if (positionDiff !== 0) {
      return positionDiff;
    }

    const timestampDiff =
      toTimestampValue(a.occurred_at ?? a.scheduled_for) -
      toTimestampValue(b.occurred_at ?? b.scheduled_for);
    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    const sequenceDiff = (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER);
    if (sequenceDiff !== 0) {
      return sequenceDiff;
    }

    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}
