export type ThreadState = 'dormant' | 'active' | 'escalated' | 'resolved';
export type Role = 'PLAYER' | 'GM' | 'HELPER_GM';

export type Thread = {
  id: string;
  title: string;
  state: ThreadState;
  summary: string;
  hook: string;
  gmTruth: string;
};

export const THREADS: Thread[] = [
  {
    id: 'ashfall-echo',
    title: 'Ashfall Echo in the Catacombs',
    state: 'active',
    summary:
      'A low bell rings under the old chapel each moonrise. The party suspects a survivor is signaling from below.',
    hook: 'A coded bell sequence points to a hidden vault keyed to family oaths.',
    gmTruth: 'The “survivor” is a memory construct baiting oath-bound descendants into opening a sealed breach.',
  },
  {
    id: 'green-accord',
    title: 'The Green Accord',
    state: 'dormant',
    summary:
      'Negotiations with the marsh clans stalled after a courier vanished near reed marker nine.',
    hook: 'Recover the courier satchel to restart talks before winter roads close.',
    gmTruth: 'A city magistrate paid raiders to intercept the courier and collapse the treaty.',
  },
  {
    id: 'sable-lantern',
    title: 'Sable Lantern Incident',
    state: 'escalated',
    summary:
      'Three districts report synchronized blackouts and sightings of masked lantern-bearers.',
    hook: 'Track one lantern procession to identify the command node before dawn.',
    gmTruth: 'The cult is testing grid failures to hide an abduction list tied to heirs.',
  },
  {
    id: 'winter-court',
    title: 'Winter Court Settlement',
    state: 'resolved',
    summary:
      'The court accepted reparations and reopened trade after testimony from two neutral witnesses.',
    hook: 'Archive sworn statements and close out pending claimant favors.',
    gmTruth: 'One witness was bribed; exposure would reopen the conflict and invalidate terms.',
  },
];
