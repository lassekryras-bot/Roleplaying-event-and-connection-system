import type { Effect, Event, Location, LocationState, Relation, Session } from '@/generated/campaign-v2';

export type CampaignV2ObjectKind = 'location' | 'locationState' | 'session' | 'event' | 'effect';
export type CampaignV2RelationType = Relation['type'];
export type CampaignV2RelationDirection = 'incoming' | 'outgoing' | 'both';

type CampaignV2RawDocumentMap = {
  location: Location;
  locationState: LocationState;
  session: Session;
  event: Event;
  effect: Effect;
};

type WithNormalizedRelations<T> = Omit<T, 'relations'> & {
  relations: Relation[];
};

export type CampaignV2DocumentRecordMap = {
  location: WithNormalizedRelations<Location>;
  locationState: WithNormalizedRelations<LocationState>;
  session: WithNormalizedRelations<Session>;
  event: WithNormalizedRelations<Event>;
  effect: WithNormalizedRelations<Effect>;
};

export type CampaignV2ObjectRecord = CampaignV2DocumentRecordMap[CampaignV2ObjectKind];

export type CampaignV2GraphSource = {
  locations?: readonly CampaignV2RawDocumentMap['location'][];
  locationStates?: readonly CampaignV2RawDocumentMap['locationState'][];
  sessions?: readonly CampaignV2RawDocumentMap['session'][];
  events?: readonly CampaignV2RawDocumentMap['event'][];
  effects?: readonly CampaignV2RawDocumentMap['effect'][];
};

export type CampaignV2ResolvedRelation = {
  source: CampaignV2ObjectRecord;
  relation: Relation;
  target: CampaignV2ObjectRecord | null;
};

export type CampaignV2RelatedObject = {
  object: CampaignV2ObjectRecord;
  direction: CampaignV2RelationDirection;
  relations: Relation[];
};

export type CampaignV2RelationGraph = {
  listObjects(): CampaignV2ObjectRecord[];
  getObject(id: string): CampaignV2ObjectRecord | null;
  getResolvedRelationsForObject(objectOrId: string | CampaignV2ObjectRecord): CampaignV2ResolvedRelation[];
  getRelationsByType(
    objectOrId: string | Pick<CampaignV2ObjectRecord, 'id' | 'relations'>,
    relationType: CampaignV2RelationType,
  ): Relation[];
  resolveTarget(relation: Relation): CampaignV2ObjectRecord | null;
  getObjectsRelatedTo(id: string): CampaignV2RelatedObject[];
};

const RELATION_TYPES: CampaignV2RelationType[] = [
  'dependsOn',
  'unlocks',
  'follows',
  'modifies',
  'occursAt',
  'belongsTo',
  'relatedTo',
  'appliesTo',
  'contains',
  'partOf',
  'involves',
  'blocks',
];
const RELATION_STATUSES = ['active', 'inactive', 'draft'] as const;
const VALID_RELATION_TYPES = new Set<CampaignV2RelationType>(RELATION_TYPES);
const VALID_RELATION_STATUSES = new Set<(typeof RELATION_STATUSES)[number]>(RELATION_STATUSES);

export function parseCampaignV2Relation(relation: unknown): Relation | null {
  if (!relation || typeof relation !== 'object') {
    return null;
  }

  const candidate = relation as Partial<Relation>;
  const type = typeof candidate.type === 'string' ? candidate.type : '';
  const targetId = typeof candidate.targetId === 'string' ? candidate.targetId.trim() : '';

  if (!VALID_RELATION_TYPES.has(type as CampaignV2RelationType) || targetId.length === 0) {
    return null;
  }

  const normalized: Relation = {
    type: type as CampaignV2RelationType,
    targetId,
  };

  if (typeof candidate.id === 'string' && candidate.id.trim().length > 0) {
    normalized.id = candidate.id.trim();
  }

  if (typeof candidate.note === 'string' || candidate.note === null) {
    normalized.note = candidate.note;
  }

  if (typeof candidate.status === 'string' && VALID_RELATION_STATUSES.has(candidate.status as (typeof RELATION_STATUSES)[number])) {
    normalized.status = candidate.status as (typeof RELATION_STATUSES)[number];
  }

  return normalized;
}

function createRelationKey(relation: Relation) {
  return relation.id ? `id:${relation.id}` : `${relation.type}:${relation.targetId}`;
}

function normalizeDocumentGroup<K extends CampaignV2ObjectKind>(
  documents: readonly CampaignV2RawDocumentMap[K][] | undefined,
): CampaignV2DocumentRecordMap[K][] {
  return (documents ?? []).map((document) => normalizeCampaignV2Document(document));
}

function toObjectArray(source: CampaignV2GraphSource): CampaignV2ObjectRecord[] {
  return [
    ...normalizeDocumentGroup<'location'>(source.locations),
    ...normalizeDocumentGroup<'locationState'>(source.locationStates),
    ...normalizeDocumentGroup<'session'>(source.sessions),
    ...normalizeDocumentGroup<'event'>(source.events),
    ...normalizeDocumentGroup<'effect'>(source.effects),
  ];
}

function resolveObject(
  objectsById: Map<string, CampaignV2ObjectRecord>,
  objectOrId: string | Pick<CampaignV2ObjectRecord, 'id' | 'relations'>,
) {
  if (typeof objectOrId === 'string') {
    return objectsById.get(objectOrId) ?? null;
  }

  return objectsById.get(objectOrId.id) ?? normalizeCampaignV2Document(objectOrId as CampaignV2ObjectRecord);
}

function compareRelatedObjects(left: CampaignV2RelatedObject, right: CampaignV2RelatedObject) {
  const leftTitle = left.object.title;
  const rightTitle = right.object.title;
  return left.object.type.localeCompare(right.object.type) || leftTitle.localeCompare(rightTitle);
}

export function normalizeCampaignV2Relations(relations: unknown): Relation[] {
  if (!Array.isArray(relations)) {
    return [];
  }

  const normalized: Relation[] = [];
  const seenKeys = new Set<string>();

  for (const relation of relations) {
    const normalizedRelation = parseCampaignV2Relation(relation);
    if (!normalizedRelation) {
      continue;
    }

    const relationKey = createRelationKey(normalizedRelation);
    if (seenKeys.has(relationKey)) {
      continue;
    }

    seenKeys.add(relationKey);
    normalized.push(normalizedRelation);
  }

  return normalized;
}

export function normalizeCampaignV2Document<K extends CampaignV2ObjectKind>(
  document: CampaignV2RawDocumentMap[K],
): CampaignV2DocumentRecordMap[K] {
  return {
    ...document,
    relations: normalizeCampaignV2Relations((document as { relations?: unknown }).relations),
  } as CampaignV2DocumentRecordMap[K];
}

export function getRelationsByType(
  object: Pick<CampaignV2ObjectRecord, 'relations'> | null | undefined,
  relationType: CampaignV2RelationType,
) {
  return normalizeCampaignV2Relations(object?.relations).filter((relation) => relation.type === relationType);
}

export function createCampaignV2RelationGraph(source: CampaignV2GraphSource): CampaignV2RelationGraph {
  const objects = toObjectArray(source);
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const outgoingBySourceId = new Map<string, CampaignV2ResolvedRelation[]>();
  const incomingByTargetId = new Map<string, CampaignV2ResolvedRelation[]>();

  for (const object of objects) {
    const outgoingRelations = object.relations.map((relation) => ({
      source: object,
      relation,
      target: objectsById.get(relation.targetId) ?? null,
    }));
    outgoingBySourceId.set(object.id, outgoingRelations);

    for (const resolvedRelation of outgoingRelations) {
      const incomingRelations = incomingByTargetId.get(resolvedRelation.relation.targetId) ?? [];
      incomingRelations.push(resolvedRelation);
      incomingByTargetId.set(resolvedRelation.relation.targetId, incomingRelations);
    }
  }

  return {
    listObjects() {
      return objects.slice();
    },
    getObject(id) {
      return objectsById.get(id) ?? null;
    },
    getResolvedRelationsForObject(objectOrId) {
      const object = resolveObject(objectsById, objectOrId);
      if (!object) {
        return [];
      }

      return [...(outgoingBySourceId.get(object.id) ?? [])];
    },
    getRelationsByType(objectOrId, relationType) {
      const object = resolveObject(objectsById, objectOrId);
      return getRelationsByType(object, relationType);
    },
    resolveTarget(relation) {
      return objectsById.get(relation.targetId) ?? null;
    },
    getObjectsRelatedTo(id) {
      const relatedById = new Map<string, CampaignV2RelatedObject>();
      const outgoingRelations = outgoingBySourceId.get(id) ?? [];

      for (const outgoingRelation of outgoingRelations) {
        if (!outgoingRelation.target) {
          continue;
        }

        relatedById.set(outgoingRelation.target.id, {
          object: outgoingRelation.target,
          direction: 'outgoing',
          relations: [outgoingRelation.relation],
        });
      }

      for (const incomingRelation of incomingByTargetId.get(id) ?? []) {
        const existing = relatedById.get(incomingRelation.source.id);
        if (existing) {
          existing.direction = existing.direction === 'outgoing' ? 'both' : existing.direction;
          existing.relations = normalizeCampaignV2Relations([...existing.relations, incomingRelation.relation]);
          continue;
        }

        relatedById.set(incomingRelation.source.id, {
          object: incomingRelation.source,
          direction: 'incoming',
          relations: [incomingRelation.relation],
        });
      }

      return [...relatedById.values()].sort(compareRelatedObjects);
    },
  };
}

export function resolveTarget(relation: Relation, graph: CampaignV2RelationGraph) {
  return graph.resolveTarget(relation);
}

export function getObjectsRelatedTo(id: string, graph: CampaignV2RelationGraph) {
  return graph.getObjectsRelatedTo(id);
}
