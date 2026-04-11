import test from "node:test";
import assert from "node:assert/strict";

import {
  attachEffectModifier,
  attachEffectToLocation,
  createCampaignV2Effect,
  migrateLegacyPatternToCampaignV2Effect,
  seedHarborWantedEffects,
} from "../../src/data/campaignV2EffectMigration.js";

test("legacy pattern migration builds an ongoing effect with the new scope model", () => {
  const effect = migrateLegacyPatternToCampaignV2Effect({
    effectId: "effect-harbor-conspiracy",
    pattern: {
      id: "pattern-harbor-conspiracy",
      title: "Harbor Conspiracy",
      summary: "Disappearances are being covered up as labor unrest.",
      escalationLevel: 2,
      playerVisible: true,
    },
    patternThreads: [
      { title: "Whispers in the Harbor", state: "active", timelineAnchor: "now" },
      { title: "Night Watch Vanishes", state: "escalated", timelineAnchor: "now" },
    ],
    scope: "city",
  });

  assert.equal(effect.effectType, "pressure");
  assert.equal(effect.scope, "city");
  assert.equal(effect.severity, "medium");
  assert.match(effect.notes, /Whispers in the Harbor/);
  assert.match(effect.notes, /Imported from legacy pattern pattern-harbor-conspiracy/);
});

test("effect helpers attach locations and modifiers through shared relations", () => {
  const wantedInCity = createCampaignV2Effect({
    id: "effect-wanted-in-city",
    title: "Wanted in City",
    summary: "Descriptions are circulating across the harbor.",
    status: "active",
    effectType: "wanted",
    scope: "city",
    severity: "high",
  });
  const localModifier = attachEffectModifier(
    attachEffectToLocation(
      createCampaignV2Effect({
        id: "effect-bar-ignores-wanted-status",
        title: "Bar Ignores Wanted Status",
        summary: "The crew still has one safe local counter-pressure.",
        status: "active",
        effectType: "safe-haven",
        scope: "local",
        severity: "low",
      }),
      "location-union-yard",
    ),
    wantedInCity.id,
  );

  assert.ok(localModifier.relations.some((relation) => relation.type === "appliesTo" && relation.targetId === "location-union-yard"));
  assert.ok(localModifier.relations.some((relation) => relation.type === "modifies" && relation.targetId === wantedInCity.id));
});

test("seeded harbor effects produce a city-wide effect, a local effect, and a local modifier", () => {
  const effects = seedHarborWantedEffects({
    buildId: (prefix, preferredSuffix) => `${prefix}-${preferredSuffix}`,
    locationId: "location-entity-union-yard",
    now: {
      playerSummary: "The harbor is uneasy and the watch is stretched thin.",
      gmTruth: "Missing-person reports are being buried.",
    },
    nowEventId: "event-now-project-1",
    supportingEventIds: ["event-thread-whispers-harbor"],
  });

  assert.equal(effects.length, 3);

  const wantedInCity = effects.find((effect) => effect.title === "Wanted in City");
  const heightenedSecurity = effects.find((effect) => effect.title === "Heightened Security");
  const barIgnoresWantedStatus = effects.find((effect) => effect.title === "Bar Ignores Wanted Status");

  assert.ok(wantedInCity);
  assert.equal(wantedInCity.scope, "city");
  assert.ok(wantedInCity.relations.some((relation) => relation.type === "relatedTo" && relation.targetId === "event-now-project-1"));

  assert.ok(heightenedSecurity);
  assert.equal(heightenedSecurity.scope, "local");
  assert.ok(heightenedSecurity.relations.some((relation) => relation.type === "appliesTo" && relation.targetId === "location-entity-union-yard"));

  assert.ok(barIgnoresWantedStatus);
  assert.ok(barIgnoresWantedStatus.relations.some((relation) => relation.type === "modifies" && relation.targetId === wantedInCity.id));
});
