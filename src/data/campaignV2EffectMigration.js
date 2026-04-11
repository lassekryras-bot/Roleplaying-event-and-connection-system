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

function dedupeStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === "string" && value.trim() !== ""))];
}

function pushRelation(relations, relation) {
  if (!relation?.type || !relation?.targetId) {
    return;
  }

  if (!relations.some((existing) => existing.type === relation.type && existing.targetId === relation.targetId)) {
    relations.push(relation);
  }
}

function mapEscalationLevelToSeverity(level) {
  if (level >= 4) {
    return "critical";
  }

  if (level >= 3) {
    return "high";
  }

  if (level >= 2) {
    return "medium";
  }

  return "low";
}

function mapPatternToEffectStatus(patternThreads) {
  if (patternThreads.length === 0) {
    return "inactive";
  }

  if (patternThreads.every((thread) => thread.state === "resolved")) {
    return "resolved";
  }

  if (patternThreads.every((thread) => thread.timelineAnchor === "past")) {
    return "archived";
  }

  if (patternThreads.some((thread) => thread.state === "active" || thread.state === "escalated")) {
    return "active";
  }

  return "inactive";
}

export function createCampaignV2Effect({
  effectType = null,
  id,
  notes = null,
  relations = [],
  scope = null,
  severity = null,
  status,
  summary,
  title,
} = {}) {
  if (!id) {
    throw new Error("id is required");
  }

  if (!title) {
    throw new Error("title is required");
  }

  if (!summary) {
    throw new Error("summary is required");
  }

  if (!status) {
    throw new Error("status is required");
  }

  return {
    id,
    type: "effect",
    title,
    summary,
    status,
    notes,
    relations: Array.isArray(relations) ? relations : [],
    effectType,
    scope,
    severity,
  };
}

export function attachEffectToLocation(effect, locationId, relationType = "appliesTo") {
  if (!locationId) {
    return effect;
  }

  const relations = Array.isArray(effect.relations) ? [...effect.relations] : [];
  pushRelation(relations, {
    type: relationType,
    targetId: locationId,
  });

  return {
    ...effect,
    relations,
  };
}

export function attachEffectModifier(effect, targetEffectId) {
  if (!targetEffectId) {
    return effect;
  }

  const relations = Array.isArray(effect.relations) ? [...effect.relations] : [];
  pushRelation(relations, {
    type: "modifies",
    targetId: targetEffectId,
  });

  return {
    ...effect,
    relations,
  };
}

export function migrateLegacyPatternToCampaignV2Effect({
  effectId,
  pattern,
  patternThreads = [],
  scope = "city",
  relatedLocationId = null,
} = {}) {
  if (!pattern || typeof pattern !== "object") {
    throw new Error("pattern is required");
  }

  if (!effectId) {
    throw new Error("effectId is required");
  }

  let effect = {
    id: effectId,
    type: "effect",
    title: pattern.title,
    summary: firstNonEmpty(pattern.summary, `Shadow-generated effect for ${pattern.title}.`),
    status: mapPatternToEffectStatus(patternThreads),
    effectType: "pressure",
    scope,
    severity: mapEscalationLevelToSeverity(pattern.escalationLevel),
    notes: joinParagraphs([
      patternThreads.length > 0
        ? `Legacy threads in this pattern: ${patternThreads.map((thread) => thread.title).join(", ")}.`
        : "",
      pattern.playerVisible ? "" : "Legacy pattern was GM-only in the source data.",
      `Imported from legacy pattern ${pattern.id}.`,
    ]),
    relations: [],
  };

  if (scope !== "city" && relatedLocationId) {
    effect = attachEffectToLocation(effect, relatedLocationId);
  }

  return effect;
}

export function seedHarborWantedEffects({
  buildId,
  locationId,
  now,
  nowEventId = null,
  supportingEventIds = [],
} = {}) {
  if (!locationId || typeof buildId !== "function") {
    return [];
  }

  const wantedInCityId = buildId("effect", "wanted-in-city", "Wanted in City");
  const wantedInCity = createCampaignV2Effect({
    id: wantedInCityId,
    title: "Wanted in City",
    summary: "Descriptions are circulating across the harbor, so anyone tied to the unrest draws attention fast.",
    status: "active",
    effectType: "wanted",
    scope: "city",
    severity: "high",
    notes: joinParagraphs([
      now?.playerSummary,
      now?.gmTruth,
      "Seeded as a city-wide pressure from the current campaign moment.",
    ]),
  });

  if (nowEventId) {
    pushRelation(wantedInCity.relations, {
      type: "relatedTo",
      targetId: nowEventId,
    });
  }

  const heightenedSecurity = attachEffectToLocation(
    createCampaignV2Effect({
      id: buildId("effect", "heightened-security", "Heightened Security"),
      title: "Heightened Security",
      summary: "Extra watch presence, questions at the gate, and checkpoint nerves make the union yard harder to work quietly.",
      status: "active",
      effectType: "security",
      scope: "local",
      severity: "medium",
      notes: "Seeded from the harbor unrest threads to model a persistent local pressure.",
    }),
    locationId,
  );

  for (const eventId of supportingEventIds) {
    pushRelation(heightenedSecurity.relations, {
      type: "relatedTo",
      targetId: eventId,
    });
  }

  const barIgnoresWantedStatus = attachEffectModifier(
    attachEffectToLocation(
      createCampaignV2Effect({
        id: buildId("effect", "bar-ignores-wanted-status", "Bar Ignores Wanted Status"),
        title: "Bar Ignores Wanted Status",
        summary: "A back-room dockside bar near the union yard keeps serving the crew even when the city-wide heat is up.",
        status: "active",
        effectType: "safe-haven",
        scope: "local",
        severity: "low",
        notes: "Seeded as a local counter-pressure so prep can show a modifier overriding a broader effect.",
      }),
      locationId,
    ),
    wantedInCityId,
  );

  return [wantedInCity, heightenedSecurity, barIgnoresWantedStatus];
}
