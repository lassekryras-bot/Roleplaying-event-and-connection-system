const threads = [
  {
    id: "thread-1",
    title: "Whispers in the harbor",
    state: "active",
    gm_truth: "The harbor master is secretly paid by the antagonist.",
    player_summary: "Dockworkers have gone missing at night.",
  },
  {
    id: "thread-2",
    title: "Ashes in the chapel",
    state: "dormant",
    gm_truth: "A relic was swapped by a cult insider.",
    player_summary: "The chapel is closed after a suspicious fire.",
  },
];

const events = [
  {
    id: "event-1",
    title: "Dock strike begins",
    timeline_position: "past",
    sequence: 10,
  },
  {
    id: "event-2",
    title: "Night watch vanishes",
    timeline_position: "now",
    sequence: 20,
  },
  {
    id: "event-3",
    title: "Harbor riots spread",
    timeline_position: "future_possible",
    sequence: 30,
  },
];

export function getThreadById(threadId) {
  return threads.find((thread) => thread.id === threadId);
}

export function listThreads() {
  return threads.map((thread) => ({ ...thread }));
}

export function listEvents() {
  return events.map((event) => ({ ...event }));
}
