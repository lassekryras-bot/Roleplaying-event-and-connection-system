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

function buildHookChecksSummary(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return "";
  }

  return `Checks: ${checks
    .map((check) => {
      const label = firstNonEmpty(check.label, check.id, "check");
      const attribute = normalizeText(check.attribute);
      const dc = Number.isFinite(check.dc) ? `DC ${check.dc}` : "";
      return [label, attribute, dc].filter(Boolean).join(" ");
    })
    .join("; ")}`;
}

function buildReadAloudSummary(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return "";
  }

  return `Read-aloud cues: ${sections
    .map((section) =>
      [normalizeText(section.header), normalizeText(section.trigger), normalizeText(section.text)]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean)
    .join("; ")}`;
}

function mapHookStatusToEventStatus(status) {
  switch (status) {
    case "in_progress":
      return "active";
    case "resolved":
      return "resolved";
    case "discarded":
      return "missed";
    case "available":
    default:
      return "available";
  }
}

function mapThreadStatusToEventStatus(thread) {
  if (thread.state === "resolved") {
    return "resolved";
  }

  if (thread.timelineAnchor === "past") {
    return "archived";
  }

  if (thread.timelineAnchor === "future_possible") {
    return thread.state === "dormant" ? "locked" : "available";
  }

  if (thread.state === "dormant") {
    return "available";
  }

  return "active";
}

function containsKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function inferCampaignV2EventType({
  sourceKind = "legacy",
  title = "",
  summary = "",
  description = "",
  notes = "",
  status = "",
  state = "",
  timelineAnchor = "",
} = {}) {
  const searchText = [title, summary, description, notes, status, state, timelineAnchor]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (sourceKind === "now") {
    return "consequence-triggered";
  }

  if (
    containsKeyword(searchText, ["ambush", "combat", "fight", "battle", "attack", "raid", "strike", "assault", "showdown", "brawl", "chase"])
  ) {
    return "combat-happened";
  }

  if (
    containsKeyword(searchText, ["clue", "ledger", "evidence", "proof", "rumor", "lead", "note", "map", "secret", "record", "archive", "route", "trail"])
  ) {
    return "clue-found";
  }

  if (
    containsKeyword(searchText, ["meet", "meeting", "parley", "broker", "auctioneer", "keeper", "librarian", "contact", "captain", "question", "talk", "speak"])
  ) {
    return "npc-meeting";
  }

  if (
    state === "escalated" ||
    timelineAnchor === "past" ||
    containsKeyword(searchText, ["consequence", "aftermath", "alarm", "fallout", "lockdown", "blackmail", "debt", "pressure", "security", "reprisal", "trigger"])
  ) {
    return "consequence-triggered";
  }

  return "hook-progressed";
}

function attachEventToLocation(event, locationId, relationType = "occursAt") {
  if (!locationId) {
    return event;
  }

  const relations = Array.isArray(event.relations) ? [...event.relations] : [];
  pushRelation(relations, {
    type: relationType,
    targetId: locationId,
  });

  return {
    ...event,
    relations,
  };
}

function attachEventToSession(event, sessionId) {
  if (!sessionId) {
    return event;
  }

  const relations = Array.isArray(event.relations) ? [...event.relations] : [];
  pushRelation(relations, {
    type: "relatedTo",
    targetId: sessionId,
  });

  return {
    ...event,
    relations,
  };
}

function attachEventToThread(event, threadId) {
  if (!threadId) {
    return event;
  }

  const relations = Array.isArray(event.relations) ? [...event.relations] : [];
  pushRelation(relations, {
    type: "relatedTo",
    targetId: threadId,
  });

  return {
    ...event,
    relations,
  };
}

export function migrateLegacyHookToCampaignV2Event({
  hook,
  eventId,
  locationId = null,
  relatedSessionIds = [],
  relatedThreadTitles = [],
} = {}) {
  if (!hook || typeof hook !== "object") {
    throw new Error("hook is required");
  }

  if (!eventId) {
    throw new Error("eventId is required");
  }

  let event = {
    id: eventId,
    type: "event",
    title: firstNonEmpty(hook.headline, hook.title, hook.id),
    summary: firstNonEmpty(hook.description, hook.headline, hook.title, "Legacy hook"),
    status: mapHookStatusToEventStatus(hook.status),
    eventType: inferCampaignV2EventType({
      sourceKind: "hook",
      title: hook.headline,
      summary: hook.description,
      description: buildHookChecksSummary(hook.checks),
      notes: hook.notes,
      status: hook.status,
    }),
    notes: joinParagraphs([
      buildHookChecksSummary(hook.checks),
      buildReadAloudSummary(hook.readAloudSections),
      hook.notes,
      hook.priority ? `Priority: ${hook.priority}.` : "",
      relatedThreadTitles.length > 0 ? `Linked thread refs: ${relatedThreadTitles.join(", ")}.` : "",
      `Imported from gm-timeline hook ${hook.id}.`,
    ]),
    relations: [],
    createdEffectIds: [],
  };

  event = attachEventToLocation(event, locationId);
  for (const sessionId of dedupeStrings(relatedSessionIds)) {
    event = attachEventToSession(event, sessionId);
  }

  return event;
}

export function migrateLegacyThreadToCampaignV2Event({
  thread,
  eventId,
  relatedLocationIds = [],
  relatedSessionIds = [],
  effectId = null,
} = {}) {
  if (!thread || typeof thread !== "object") {
    throw new Error("thread is required");
  }

  if (!eventId) {
    throw new Error("eventId is required");
  }

  let event = {
    id: eventId,
    type: "event",
    title: firstNonEmpty(thread.title, thread.id),
    summary: firstNonEmpty(thread.playerSummary, thread.hook, thread.gmTruth, thread.title, "Legacy thread"),
    status: mapThreadStatusToEventStatus(thread),
    eventType: inferCampaignV2EventType({
      sourceKind: "thread",
      title: thread.title,
      summary: thread.playerSummary,
      description: thread.hook,
      notes: thread.gmTruth,
      state: thread.state,
      timelineAnchor: thread.timelineAnchor,
    }),
    notes: joinParagraphs([
      thread.hook,
      thread.gmTruth ? `GM truth: ${thread.gmTruth}` : "",
      `Legacy thread state: ${thread.state}.`,
      `Legacy timeline anchor: ${thread.timelineAnchor}.`,
      thread.playerVisible ? "" : "Source thread was GM-only.",
      `Imported from legacy thread ${thread.id}.`,
    ]),
    relations: [],
    createdEffectIds: [],
  };

  dedupeStrings(relatedLocationIds).forEach((locationId, index) => {
    event = attachEventToLocation(event, locationId, index === 0 ? "occursAt" : "involves");
  });

  for (const sessionId of dedupeStrings(relatedSessionIds)) {
    event = attachEventToSession(event, sessionId);
  }

  if (effectId) {
    const relations = [...event.relations];
    pushRelation(relations, {
      type: "belongsTo",
      targetId: effectId,
    });
    event = {
      ...event,
      relations,
    };
  }

  return event;
}

export function migrateLegacyNowToCampaignV2Event({
  now,
  eventId,
  projectName = "",
  activeSessionId = null,
  activeLocationId = null,
} = {}) {
  if (!now || typeof now !== "object") {
    throw new Error("now is required");
  }

  if (!eventId) {
    throw new Error("eventId is required");
  }

  let event = {
    id: eventId,
    type: "event",
    title: firstNonEmpty(now.title, "Current moment"),
    summary: firstNonEmpty(
      now.playerSummary,
      now.gmTruth,
      projectName ? `Current moment for ${projectName}.` : "Current moment",
    ),
    status: "active",
    eventType: inferCampaignV2EventType({
      sourceKind: "now",
      title: now.title,
      summary: now.playerSummary,
      notes: now.gmTruth,
    }),
    notes: joinParagraphs([
      now.gmTruth ? `GM truth: ${now.gmTruth}` : "",
      "Shadow-generated from now.json.",
    ]),
    relations: [],
    createdEffectIds: [],
  };

  event = attachEventToSession(event, activeSessionId);
  event = attachEventToLocation(event, activeLocationId);

  return event;
}

export function attachCampaignV2EventToThread(event, threadId) {
  return attachEventToThread(event, threadId);
}
