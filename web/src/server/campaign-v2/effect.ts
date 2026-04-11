import type { Effect, Location, Relation } from '@/generated/campaign-v2';

import { getRelationsByType, normalizeCampaignV2Relations } from './relations';

type LocationCollection = readonly Location[] | ReadonlyMap<string, Location>;
type EffectCollection = readonly Effect[] | ReadonlyMap<string, Effect>;

export type CampaignV2EffectScope = NonNullable<NonNullable<Effect['scope']>>;

export type CreateCampaignV2EffectOptions = {
  id: string;
  title: string;
  summary: string;
  status: Effect['status'];
  notes?: string | null;
  relations?: Relation[];
  effectType?: string | null;
  scope?: Effect['scope'];
  severity?: Effect['severity'];
};

export type CampaignV2ResolvedEffect = {
  effect: Effect;
  locations: Location[];
  modifies: Effect[];
  modifiedBy: Effect[];
};

export type CampaignV2LocationEffectResolution = {
  location: Location;
  localEffects: Effect[];
  inheritedEffects: Effect[];
  localModifiersOfInherited: Effect[];
  allRelevantEffects: Effect[];
};

function toLocationMap(locations: LocationCollection): ReadonlyMap<string, Location> {
  if (!Array.isArray(locations)) {
    return locations as ReadonlyMap<string, Location>;
  }

  return new Map(locations.map((location) => [location.id, location]));
}

function toEffectMap(effects: EffectCollection): ReadonlyMap<string, Effect> {
  if (!Array.isArray(effects)) {
    return effects as ReadonlyMap<string, Effect>;
  }

  return new Map(effects.map((effect) => [effect.id, effect]));
}

function uniqueSortedByTitle<T extends { id: string; title: string }>(values: T[]) {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort(
    (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
  );
}

function appendEffectRelation(effect: Effect, relation: Relation): Effect {
  return {
    ...effect,
    relations: normalizeCampaignV2Relations([...(effect.relations ?? []), relation]),
  };
}

function getTargetLocationIds(effect: Pick<Effect, 'relations'>) {
  return normalizeCampaignV2Relations(effect.relations).filter(
    (relation) => relation.type === 'appliesTo' || relation.type === 'occursAt',
  ).map((relation) => relation.targetId);
}

function getLocationAncestors(location: Location, locations: ReadonlyMap<string, Location>) {
  const ancestors: Location[] = [];
  let currentParentId = location.parentLocationId ?? null;
  const seen = new Set<string>();

  while (currentParentId && !seen.has(currentParentId)) {
    seen.add(currentParentId);
    const parent = locations.get(currentParentId);
    if (!parent) {
      break;
    }

    ancestors.push(parent);
    currentParentId = parent.parentLocationId ?? null;
  }

  return ancestors;
}

export function createCampaignV2Effect({
  effectType,
  id,
  notes,
  relations,
  scope = null,
  severity = null,
  status,
  summary,
  title,
}: CreateCampaignV2EffectOptions): Effect {
  return {
    id,
    type: 'effect',
    title,
    summary,
    status,
    notes: notes ?? null,
    relations: normalizeCampaignV2Relations(relations),
    effectType: effectType ?? null,
    scope,
    severity,
  };
}

export function attachEffectToLocation(
  effect: Effect,
  locationOrId: string | Pick<Location, 'id'>,
  relationType: 'appliesTo' | 'occursAt' = 'appliesTo',
) {
  const targetId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
  return appendEffectRelation(effect, {
    type: relationType,
    targetId,
  });
}

export function attachEffectModifier(effect: Effect, targetEffectOrId: string | Pick<Effect, 'id'>) {
  const targetId = typeof targetEffectOrId === 'string' ? targetEffectOrId : targetEffectOrId.id;
  return appendEffectRelation(effect, {
    type: 'modifies',
    targetId,
  });
}

export function resolveEffectLocations(effect: Pick<Effect, 'relations'>, locations: LocationCollection) {
  const locationsById = toLocationMap(locations);
  return uniqueSortedByTitle(
    getTargetLocationIds(effect)
      .map((locationId) => locationsById.get(locationId))
      .filter((location): location is Location => Boolean(location)),
  );
}

export function resolveModifiedEffects(effect: Pick<Effect, 'relations'>, effects: EffectCollection) {
  const effectsById = toEffectMap(effects);
  return uniqueSortedByTitle(
    getRelationsByType({ relations: effect.relations ?? [] }, 'modifies')
      .map((relation) => effectsById.get(relation.targetId))
      .filter((target): target is Effect => Boolean(target)),
  );
}

export function resolveEffectModifiers(effect: Pick<Effect, 'id'>, effects: EffectCollection) {
  const effectList = Array.isArray(effects) ? effects : [...effects.values()];
  return uniqueSortedByTitle(
    effectList.filter((candidate) =>
      getRelationsByType({ relations: candidate.relations ?? [] }, 'modifies').some((relation) => relation.targetId === effect.id),
    ),
  );
}

export function getDirectEffectsOnLocation(location: Location, effects: EffectCollection) {
  const effectList = Array.isArray(effects) ? effects : [...effects.values()];
  return uniqueSortedByTitle(
    effectList.filter((effect) => getTargetLocationIds(effect).includes(location.id)),
  );
}

export function getInheritedEffectsFromScope(
  location: Location,
  locations: LocationCollection,
  effects: EffectCollection,
) {
  const effectList = Array.isArray(effects) ? effects : [...effects.values()];
  const locationsById = toLocationMap(locations);
  const ancestorIds = new Set(getLocationAncestors(location, locationsById).map((ancestor) => ancestor.id));

  return uniqueSortedByTitle(
    effectList.filter((effect) => {
      if (effect.scope === 'city') {
        return true;
      }

      if (effect.scope !== 'subtree') {
        return false;
      }

      return getTargetLocationIds(effect).some((targetId) => ancestorIds.has(targetId));
    }),
  );
}

export function getLocalEffectsModifyingBroaderEffects(
  location: Location,
  locations: LocationCollection,
  effects: EffectCollection,
) {
  const localEffects = getDirectEffectsOnLocation(location, effects);
  const broaderEffectIds = new Set(getInheritedEffectsFromScope(location, locations, effects).map((effect) => effect.id));

  return uniqueSortedByTitle(
    localEffects.filter((effect) =>
      getRelationsByType(effect, 'modifies').some((relation) => broaderEffectIds.has(relation.targetId)),
    ),
  );
}

export function resolveCampaignV2Effect(
  effect: Effect,
  locations: LocationCollection,
  effects: EffectCollection,
): CampaignV2ResolvedEffect {
  return {
    effect,
    locations: resolveEffectLocations(effect, locations),
    modifies: resolveModifiedEffects(effect, effects),
    modifiedBy: resolveEffectModifiers(effect, effects),
  };
}

export function resolveCampaignV2LocationEffects(
  location: Location,
  locations: LocationCollection,
  effects: EffectCollection,
): CampaignV2LocationEffectResolution {
  const localEffects = getDirectEffectsOnLocation(location, effects);
  const inheritedEffects = getInheritedEffectsFromScope(location, locations, effects);
  const localModifiersOfInherited = getLocalEffectsModifyingBroaderEffects(location, locations, effects);

  return {
    location,
    localEffects,
    inheritedEffects,
    localModifiersOfInherited,
    allRelevantEffects: uniqueSortedByTitle([...localEffects, ...inheritedEffects]),
  };
}
