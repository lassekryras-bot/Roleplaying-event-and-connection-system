import { describe, expect, it } from 'vitest';

import { getProjectBoardData } from '../mock-data';
import { scopeProjectBoardDataForPerspective } from '../perspective';

describe('player perspective scoping', () => {
  it('filters harbor player perspectives to different visible note sets', () => {
    const data = getProjectBoardData('project-1');
    const docksideWatch = data.playerProfiles.find((profile) => profile.userId === 'player-1') ?? null;
    const ashCircle = data.playerProfiles.find((profile) => profile.userId === 'player-2') ?? null;

    const docksidePerspective = scopeProjectBoardDataForPerspective(data, 'player', docksideWatch);
    const ashPerspective = scopeProjectBoardDataForPerspective(data, 'player', ashCircle);

    expect(docksidePerspective.patterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(['pattern-harbor-conspiracy', 'pattern-lantern-routes']),
    );
    expect(docksidePerspective.patterns.map((pattern) => pattern.id)).not.toContain('pattern-ash-ritual');
    expect(ashPerspective.patterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(['pattern-ash-ritual', 'pattern-harbor-conspiracy']),
    );
    expect(ashPerspective.patterns.map((pattern) => pattern.id)).not.toContain('pattern-lantern-routes');
  });

  it('adds explicitly assigned loose threats into the hundred-note player perspectives', () => {
    const data = getProjectBoardData('project-3');
    const patternScout = data.playerProfiles.find((profile) => profile.userId === 'player-1') ?? null;

    const scopedData = scopeProjectBoardDataForPerspective(data, 'player', patternScout);

    expect(scopedData.threads.some((thread) => thread.id === 'thread-test-41')).toBe(true);
    expect(scopedData.threads.some((thread) => thread.id === 'thread-test-52')).toBe(true);
    expect(scopedData.patterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(['pattern-test-1', 'pattern-test-2', 'pattern-test-3']),
    );
  });

  it('removes staged notes from player perspectives', () => {
    const data = getProjectBoardData('project-1');
    const docksideWatch = data.playerProfiles.find((profile) => profile.userId === 'player-1') ?? null;

    data.threads.push({
      id: 'thread-staged-player-hidden',
      title: 'Staged Note',
      state: 'dormant',
      playerSummary: '',
      timelineAnchor: 'now',
      linkedEntityIds: [],
      playerVisible: false,
      staging: {
        isStaged: true,
        trayAnchor: 'now',
      },
    });
    data.patterns.push({
      id: 'pattern-staged-player-hidden',
      title: 'Staged Pattern',
      summary: '',
      escalationLevel: 1,
      threadIds: [],
      playerVisible: false,
      staging: {
        isStaged: true,
        trayAnchor: 'future_possible',
      },
    });

    const scopedData = scopeProjectBoardDataForPerspective(data, 'player', docksideWatch);

    expect(scopedData.threads.some((thread) => thread.id === 'thread-staged-player-hidden')).toBe(false);
    expect(scopedData.patterns.some((pattern) => pattern.id === 'pattern-staged-player-hidden')).toBe(false);
  });
});
