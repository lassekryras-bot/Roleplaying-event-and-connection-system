import { TimelinePosition } from "../domain/entities.js";

const TIMELINE_ORDER = Object.freeze({
  [TimelinePosition.PAST]: 0,
  [TimelinePosition.NOW]: 1,
  [TimelinePosition.FUTURE_POSSIBLE]: 2,
});

/**
 * Sort events into a consistent shared-timeline order:
 * past -> now -> future_possible
 * then by `sequence` ascending inside each segment.
 *
 * @param {Array<{timeline_position:string,sequence:number}>} events
 * @returns {Array}
 */
export function sortEventsForTimeline(events) {
  return [...events].sort((a, b) => {
    const positionDiff =
      (TIMELINE_ORDER[a.timeline_position] ?? Number.MAX_SAFE_INTEGER) -
      (TIMELINE_ORDER[b.timeline_position] ?? Number.MAX_SAFE_INTEGER);

    if (positionDiff !== 0) {
      return positionDiff;
    }

    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
}
