function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
  return values.map(normalizeText).find(Boolean) ?? "";
}

function joinParagraphs(values) {
  const parts = values.map(normalizeText).filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function pushRelation(relations, relation) {
  if (!relation?.type || !relation?.targetId) {
    return;
  }

  if (!relations.some((existing) => existing.type === relation.type && existing.targetId === relation.targetId)) {
    relations.push(relation);
  }
}

export function migrateLegacyTimelineSessionToCampaignV2({
  legacySession,
  locationId,
  previousSessionId = null,
  relatedEventIds = [],
  relatedLocationIds = [],
  startingLocationStateId = null,
  resultingLocationStateId = null,
} = {}) {
  if (!legacySession || typeof legacySession !== "object") {
    throw new Error("legacySession is required");
  }

  if (!locationId) {
    throw new Error("locationId is required");
  }

  const title = firstNonEmpty(legacySession.headline, legacySession.title, legacySession.id);
  const summary = firstNonEmpty(
    legacySession.summary,
    legacySession.expectedDirection,
    legacySession.headline,
    legacySession.title,
    "Legacy session",
  );
  const relations = [];

  for (const relatedLocationId of relatedLocationIds) {
    if (relatedLocationId && relatedLocationId !== locationId) {
      pushRelation(relations, {
        type: "involves",
        targetId: relatedLocationId,
      });
    }
  }

  for (const relatedEventId of relatedEventIds) {
    pushRelation(relations, {
      type: "relatedTo",
      targetId: relatedEventId,
    });
  }

  if (previousSessionId) {
    pushRelation(relations, {
      type: "follows",
      targetId: previousSessionId,
    });
  }

  return {
    id: legacySession.id,
    type: "session",
    title,
    locationId,
    summary,
    startingLocationStateId,
    resultingLocationStateId,
    notes: joinParagraphs([
      legacySession.expectedDirection,
      legacySession.notes,
      `Imported from gm-timeline session ${legacySession.id}.`,
    ]),
    relations,
  };
}
