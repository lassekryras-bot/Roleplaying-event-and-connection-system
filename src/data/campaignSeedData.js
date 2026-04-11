function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function dedupeValues(values) {
  return Array.from(new Set(values));
}

function createEmptySharing(playerProfiles) {
  return {
    globalNodeIds: [],
    playerNodeIdsByPlayer: Object.fromEntries(
      playerProfiles.map((profile) => [profile.userId, []]),
    ),
  };
}

function createHundredNotesTestCampaign() {
  const random = createSeededRandom(1005);
  const timelineAnchors = ["past", "now", "future_possible"];
  const patterns = Array.from({ length: 5 }, (_, index) => ({
    id: `pattern-test-${index + 1}`,
    title: `Test Pattern ${index + 1}`,
    summary: `Pattern ${index + 1} groups a fixed cluster of threats for board load testing.`,
    escalationLevel: (index % 3) + 1,
    threadIds: [],
    playerVisible: true,
  }));
  const linkedEntities = {};

  for (let index = 0; index < patterns.length; index += 1) {
    linkedEntities[`entity-pattern-anchor-${index + 1}`] = {
      id: `entity-pattern-anchor-${index + 1}`,
      type: "location",
      name: `Pattern Anchor ${index + 1}`,
      playerVisible: true,
    };
  }

  for (let index = 0; index < 16; index += 1) {
    linkedEntities[`entity-cross-${index + 1}`] = {
      id: `entity-cross-${index + 1}`,
      type: "npc",
      name: `Cross Signal ${String(index + 1).padStart(2, "0")}`,
      playerVisible: true,
    };
  }

  for (let index = 0; index < 6; index += 1) {
    linkedEntities[`entity-zone-${index + 1}`] = {
      id: `entity-zone-${index + 1}`,
      type: "location",
      name: `Stress Zone ${index + 1}`,
      playerVisible: true,
    };
  }

  const threads = Array.from({ length: 95 }, (_, index) => {
    const threadNumber = index + 1;
    const threadId = `thread-test-${String(threadNumber).padStart(2, "0")}`;
    const patternIndex = index < 40 ? Math.floor(index / 8) : null;
    const patternId = patternIndex !== null ? patterns[patternIndex].id : undefined;
    const linkedEntityIds = [
      `entity-zone-${(index % 6) + 1}`,
      `entity-cross-${1 + Math.floor(random() * 16)}`,
    ];

    if (patternIndex !== null) {
      linkedEntityIds.push(`entity-pattern-anchor-${patternIndex + 1}`);
      patterns[patternIndex].threadIds.push(threadId);
    }

    if (patternIndex === null) {
      linkedEntityIds.push(`entity-pattern-anchor-${1 + Math.floor(random() * patterns.length)}`);
    }

    if (random() < 0.35) {
      linkedEntityIds.push(`entity-cross-${1 + Math.floor(random() * 16)}`);
    }

    if (random() < 0.18) {
      linkedEntityIds.push(`entity-zone-${1 + Math.floor(random() * 6)}`);
    }

    return {
      id: threadId,
      title: `Test Threat ${String(threadNumber).padStart(2, "0")}`,
      state: threadNumber % 5 === 0 ? "escalated" : "active",
      hook:
        threadNumber % 3 === 0
          ? `Pressure note ${String(threadNumber).padStart(2, "0")} needs attention.`
          : undefined,
      playerSummary: `Test threat ${String(threadNumber).padStart(2, "0")} keeps pressure on the board for layout checks.`,
      gmTruth: `Threat ${String(threadNumber).padStart(2, "0")} is part of the seeded stress campaign used to inspect board density.`,
      timelineAnchor: timelineAnchors[index % timelineAnchors.length],
      linkedEntityIds: dedupeValues(linkedEntityIds),
      patternId,
      playerVisible: true,
    };
  });

  const playerProfiles = [
    {
      userId: "player-1",
      username: "Adminplayer",
      displayName: "Pattern Scout",
      patternId: "pattern-test-1",
      perspectivePatternIds: ["pattern-test-2", "pattern-test-3"],
      perspectiveThreadIds: ["thread-test-41", "thread-test-52", "thread-test-67"],
    },
    {
      userId: "player-3",
      username: "Adminplayer3",
      displayName: "Crosswind Watch",
      patternId: "pattern-test-4",
      perspectivePatternIds: ["pattern-test-5"],
      perspectiveThreadIds: ["thread-test-58", "thread-test-73", "thread-test-84"],
    },
  ];

  return {
    project: {
      id: "project-3",
      name: "Hundred Notes Test",
      status: "active",
    },
    now: {
      id: "now",
      title: "Current moment",
      playerSummary:
        "This seeded campaign is built to stress-test note density, hover states, and cross-pattern links.",
      gmTruth:
        "Five pattern notes each own eight threats, and the remaining threats create extra random cross-pattern pressure.",
    },
    threads,
    patterns,
    linkedEntities,
    playerProfiles,
    manualLinks: [],
    sharing: createEmptySharing(playerProfiles),
  };
}

export function createSeedCampaignSnapshots() {
  const harborPlayerProfiles = [
    {
      userId: "player-1",
      username: "Adminplayer",
      displayName: "Dockside Watch",
      patternId: "pattern-harbor-conspiracy",
      perspectivePatternIds: ["pattern-lantern-routes"],
    },
    {
      userId: "player-2",
      username: "Adminplayer2",
      displayName: "Ash Circle",
      patternId: "pattern-ash-ritual",
      perspectivePatternIds: ["pattern-harbor-conspiracy"],
    },
    {
      userId: "player-3",
      username: "Adminplayer3",
      displayName: "Lantern Route",
      patternId: "pattern-lantern-routes",
      perspectivePatternIds: ["pattern-harbor-conspiracy"],
    },
  ];
  const redSignalPlayerProfiles = [
    {
      userId: "player-1",
      username: "Adminplayer",
      displayName: "Beacon Runner",
      patternId: "pattern-beacon-failure",
      perspectivePatternIds: ["pattern-river-static"],
    },
    {
      userId: "player-2",
      username: "Adminplayer2",
      displayName: "River Courier",
      patternId: "pattern-river-static",
      perspectivePatternIds: ["pattern-beacon-failure"],
    },
  ];

  return [
    {
      project: {
        id: "project-1",
        name: "Harbor of Whispers",
        status: "active",
      },
      now: {
        id: "now",
        title: "Current moment",
        playerSummary:
          "The harbor is uneasy, the watch is stretched thin, and too many rumors point toward the old ruins.",
        gmTruth:
          "The Cinder Choir is using the unrest to hide ritual logistics while the harbor master suppresses the missing-person reports.",
      },
      linkedEntities: {
        "entity-harbor-master": {
          id: "entity-harbor-master",
          type: "npc",
          name: "Harbor Master Vel",
          playerVisible: true,
        },
        "entity-cinder-choir": {
          id: "entity-cinder-choir",
          type: "npc",
          name: "The Cinder Choir",
          playerVisible: false,
        },
        "entity-ruined-chapel": {
          id: "entity-ruined-chapel",
          type: "location",
          name: "Ruined Chapel",
          playerVisible: true,
        },
        "entity-night-watch": {
          id: "entity-night-watch",
          type: "npc",
          name: "The Harbor Night Watch",
          playerVisible: true,
        },
        "entity-bell-ledger": {
          id: "entity-bell-ledger",
          type: "item",
          name: "Silent Bell Ledger",
          playerVisible: false,
        },
        "entity-union-yard": {
          id: "entity-union-yard",
          type: "location",
          name: "Dockworkers Union Yard",
          playerVisible: true,
        },
        "entity-lantern-broker": {
          id: "entity-lantern-broker",
          type: "npc",
          name: "Lantern Broker Sera",
          playerVisible: true,
        },
        "entity-lantern-routes": {
          id: "entity-lantern-routes",
          type: "location",
          name: "Lantern Route Markers",
          playerVisible: true,
        },
      },
      patterns: [
        {
          id: "pattern-harbor-conspiracy",
          title: "Harbor Conspiracy",
          summary:
            "The docks are being manipulated so disappearances look like labor unrest instead of coordinated pressure.",
          escalationLevel: 2,
          threadIds: ["thread-whispers-harbor", "thread-night-watch", "thread-dockworkers-oath"],
          playerVisible: true,
        },
        {
          id: "pattern-ash-ritual",
          title: "Ash and Ritual",
          summary:
            "The chapel fire, relic theft, and strange ash all point to ritual preparation close to the city center.",
          escalationLevel: 3,
          threadIds: ["thread-ashes-chapel", "thread-stolen-relic"],
          playerVisible: true,
        },
        {
          id: "pattern-silent-bell",
          title: "Silent Bell Network",
          summary:
            "A hidden courier network is moving coded orders under the cover of dockside chaos.",
          escalationLevel: 2,
          threadIds: ["thread-bell-ledger"],
          playerVisible: false,
        },
        {
          id: "pattern-lantern-routes",
          title: "Lantern Routes",
          summary:
            "Lantern codes, safe approaches, and trap routes are quietly shaping who reaches the ruins alive.",
          escalationLevel: 1,
          threadIds: ["thread-lantern-broker"],
          playerVisible: true,
        },
      ],
      threads: [
        {
          id: "thread-whispers-harbor",
          title: "Whispers in the Harbor",
          state: "active",
          hook: "Dockworkers have started refusing night shifts.",
          playerSummary: "Dockworkers say someone is paying for silence at the piers.",
          gmTruth: "Vel has been paid to redirect patrol routes and bury the first reports.",
          timelineAnchor: "now",
          linkedEntityIds: ["entity-harbor-master", "entity-union-yard"],
          patternId: "pattern-harbor-conspiracy",
          playerVisible: true,
        },
        {
          id: "thread-night-watch",
          title: "Night Watch Vanishes",
          state: "escalated",
          hook: "A patrol disappears after following lantern lights toward the sea caves.",
          playerSummary:
            "The watch lost contact with an entire patrol near the low-tide tunnels.",
          gmTruth: "The patrol found a ritual staging point and was captured alive for leverage.",
          timelineAnchor: "now",
          linkedEntityIds: ["entity-night-watch", "entity-cinder-choir"],
          patternId: "pattern-harbor-conspiracy",
          playerVisible: true,
        },
        {
          id: "thread-dockworkers-oath",
          title: "Dockworkers Oath",
          state: "resolved",
          playerSummary:
            "A labor pledge briefly stabilized the docks before fear took over again.",
          gmTruth: "The pledge failed after the union leadership was blackmailed.",
          timelineAnchor: "past",
          linkedEntityIds: ["entity-union-yard"],
          patternId: "pattern-harbor-conspiracy",
          playerVisible: true,
        },
        {
          id: "thread-ashes-chapel",
          title: "Ashes in the Chapel",
          state: "dormant",
          hook: "Fine ash keeps appearing in the chapel even after the fire was contained.",
          playerSummary:
            "The chapel remains closed after a suspicious fire and a handful of whispered sightings.",
          gmTruth: "The ash is residue from failed rehearsal rites in the crypt.",
          timelineAnchor: "past",
          linkedEntityIds: ["entity-ruined-chapel"],
          patternId: "pattern-ash-ritual",
          playerVisible: true,
        },
        {
          id: "thread-stolen-relic",
          title: "Stolen Reliquary",
          state: "active",
          hook: "An empty reliquary was recovered with fresh wax seals.",
          playerSummary: "Someone swapped a chapel relic and left behind fresh ritual wax.",
          gmTruth:
            "The stolen relic is the final focus item for the Cinder Choir's harbor rite.",
          timelineAnchor: "future_possible",
          linkedEntityIds: ["entity-ruined-chapel", "entity-cinder-choir"],
          patternId: "pattern-ash-ritual",
          playerVisible: true,
        },
        {
          id: "thread-bell-ledger",
          title: "Silent Bell Ledger",
          state: "active",
          hook: "A courier ledger maps hidden payments and meeting routes.",
          playerSummary: "GM-only courier routes are still hidden from the players.",
          gmTruth:
            "The ledger reveals how the cult's harbor cells coordinate every public disruption.",
          timelineAnchor: "now",
          linkedEntityIds: ["entity-bell-ledger", "entity-cinder-choir"],
          patternId: "pattern-silent-bell",
          playerVisible: false,
        },
        {
          id: "thread-lantern-broker",
          title: "Lantern Broker's Warning",
          state: "active",
          playerSummary:
            "A broker warns that blue lanterns mark safe routes and amber lanterns mark traps.",
          gmTruth:
            "Sera is feeding selective truths in exchange for immunity after the crackdown.",
          timelineAnchor: "future_possible",
          linkedEntityIds: ["entity-lantern-broker", "entity-lantern-routes"],
          patternId: "pattern-lantern-routes",
          playerVisible: true,
        },
      ],
      playerProfiles: harborPlayerProfiles,
      manualLinks: [],
      sharing: createEmptySharing(harborPlayerProfiles),
    },
    {
      project: {
        id: "project-2",
        name: "The Red Signal",
        status: "active",
      },
      now: {
        id: "now",
        title: "Current moment",
        playerSummary:
          "Signal towers are flickering out of sync, and every village is blaming a different enemy.",
        gmTruth:
          "A surviving war engine buried in the hills is hijacking the old beacon network to lure militias into conflict.",
      },
      linkedEntities: {
        "entity-signal-hill": {
          id: "entity-signal-hill",
          type: "location",
          name: "Signal Hill",
          playerVisible: true,
        },
        "entity-war-engine": {
          id: "entity-war-engine",
          type: "item",
          name: "The Buried War Engine",
          playerVisible: false,
        },
        "entity-militia": {
          id: "entity-militia",
          type: "npc",
          name: "South March Militia",
          playerVisible: true,
        },
        "entity-messenger": {
          id: "entity-messenger",
          type: "npc",
          name: "Red Messenger Yara",
          playerVisible: true,
        },
        "entity-river-ferry": {
          id: "entity-river-ferry",
          type: "location",
          name: "River Ferry Crossing",
          playerVisible: true,
        },
      },
      patterns: [
        {
          id: "pattern-beacon-failure",
          title: "Beacon Failure",
          summary:
            "Signal towers are failing in a deliberate pattern, creating panic and tactical blind spots.",
          escalationLevel: 2,
          threadIds: ["thread-red-signal", "thread-south-march"],
          playerVisible: true,
        },
        {
          id: "pattern-buried-engine",
          title: "Buried Engine",
          summary:
            "Something ancient under Signal Hill is learning the region's wartime habits and exploiting them.",
          escalationLevel: 3,
          threadIds: ["thread-engine-heart"],
          playerVisible: false,
        },
        {
          id: "pattern-river-static",
          title: "River Static",
          summary:
            "Ferry crews and messengers spread conflicting signal warnings before any tower can confirm them.",
          escalationLevel: 1,
          threadIds: ["thread-river-static"],
          playerVisible: true,
        },
      ],
      threads: [
        {
          id: "thread-red-signal",
          title: "The Red Signal",
          state: "active",
          playerSummary:
            "One tower keeps flashing a red pattern no operator admits to sending.",
          gmTruth: "The pattern is a lure sequence copied from the old border war.",
          timelineAnchor: "now",
          linkedEntityIds: ["entity-signal-hill", "entity-messenger"],
          patternId: "pattern-beacon-failure",
          playerVisible: true,
        },
        {
          id: "thread-south-march",
          title: "South March Mobilizes",
          state: "escalated",
          playerSummary: "Militias are preparing to march on rumors alone.",
          gmTruth: "The militias were fed forged responses timed to the beacon failures.",
          timelineAnchor: "future_possible",
          linkedEntityIds: ["entity-militia"],
          patternId: "pattern-beacon-failure",
          playerVisible: true,
        },
        {
          id: "thread-engine-heart",
          title: "Engine Heart",
          state: "active",
          playerSummary: "GM-only engine diagnostics remain hidden.",
          gmTruth:
            "The engine is waking faster every time the network carries a false alarm.",
          timelineAnchor: "now",
          linkedEntityIds: ["entity-war-engine"],
          patternId: "pattern-buried-engine",
          playerVisible: false,
        },
        {
          id: "thread-river-static",
          title: "River Static",
          state: "active",
          playerSummary:
            "Boat crews repeat warning phrases before any official signal reaches the river crossing.",
          gmTruth:
            "The buried engine is piggybacking on ferry gossip to amplify false mobilization orders.",
          timelineAnchor: "past",
          linkedEntityIds: ["entity-river-ferry", "entity-messenger"],
          patternId: "pattern-river-static",
          playerVisible: true,
        },
      ],
      playerProfiles: redSignalPlayerProfiles,
      manualLinks: [],
      sharing: createEmptySharing(redSignalPlayerProfiles),
    },
    createHundredNotesTestCampaign(),
  ];
}
