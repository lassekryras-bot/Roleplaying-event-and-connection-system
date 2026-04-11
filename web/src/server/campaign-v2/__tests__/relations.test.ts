// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  createCampaignV2RelationGraph,
  getObjectsRelatedTo,
  getRelationsByType,
  normalizeCampaignV2Document,
  normalizeCampaignV2Relations,
  parseCampaignV2Relation,
  resolveTarget,
} from '@/server/campaign-v2';

describe('campaign-v2 relations', () => {
  it('parses and normalizes relation entries', () => {
    expect(parseCampaignV2Relation({ type: 'dependsOn', targetId: 'event-storm-front', note: 'watch this' })).toEqual({
      type: 'dependsOn',
      targetId: 'event-storm-front',
      note: 'watch this',
    });
    expect(parseCampaignV2Relation({ type: 'dependsOn', targetId: '   ' })).toBeNull();

    expect(
      normalizeCampaignV2Relations([
        { type: 'dependsOn', targetId: 'event-storm-front' },
        { type: 'dependsOn', targetId: 'event-storm-front' },
        { type: 'not-a-relation', targetId: 'event-storm-front' },
      ]),
    ).toEqual([{ type: 'dependsOn', targetId: 'event-storm-front' }]);
  });

  it('guarantees every normalized document has a relations array', () => {
    const location = normalizeCampaignV2Document<'location'>({
      id: 'location-brass-docks',
      type: 'location',
      campaignId: 'project-1',
      title: 'Brass Docks',
      summary: 'A fog-heavy district with restless traffic.',
      tags: ['docks'],
    });

    expect(location.relations).toEqual([]);
  });

  it('resolves targets and related objects through a shared graph layer', () => {
    const session = normalizeCampaignV2Document<'session'>({
      id: 'session-brass-docks-01',
      type: 'session',
      title: 'Smoke on the Quay',
      locationId: 'location-brass-docks',
      summary: 'Meet the contact on the quay.',
      relations: [
        { type: 'occursAt', targetId: 'location-brass-docks' },
        { type: 'dependsOn', targetId: 'event-ghost-barge' },
        { type: 'dependsOn', targetId: 'event-ghost-barge' },
      ],
    });
    const location = normalizeCampaignV2Document<'location'>({
      id: 'location-brass-docks',
      type: 'location',
      campaignId: 'project-1',
      title: 'Brass Docks',
      summary: 'A fog-heavy district with restless traffic.',
      tags: ['docks'],
    });
    const event = normalizeCampaignV2Document<'event'>({
      id: 'event-ghost-barge',
      type: 'event',
      title: 'Ghost Barge',
      summary: 'A quiet smuggling lead resurfaces.',
      status: 'available',
      eventType: 'hook-progressed',
      relations: [{ type: 'relatedTo', targetId: 'session-brass-docks-01' }],
    });

    const graph = createCampaignV2RelationGraph({
      sessions: [session],
      locations: [location],
      events: [event],
    });

    expect(getRelationsByType(session, 'dependsOn')).toEqual([{ type: 'dependsOn', targetId: 'event-ghost-barge' }]);
    expect(resolveTarget(session.relations[1]!, graph)).toEqual(event);
    expect(graph.getResolvedRelationsForObject('session-brass-docks-01')).toHaveLength(2);
    expect(getObjectsRelatedTo('session-brass-docks-01', graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          object: expect.objectContaining({ id: 'event-ghost-barge' }),
          direction: 'both',
        }),
        expect.objectContaining({
          object: expect.objectContaining({ id: 'location-brass-docks' }),
          direction: 'outgoing',
        }),
      ]),
    );
  });
});
