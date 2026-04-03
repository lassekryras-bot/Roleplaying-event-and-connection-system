import { ROLE_LABELS, type UserRole } from './types';

interface RoleAwareEmptyStateProps {
  role: UserRole;
  onPrimaryAction: () => void;
}

function sentenceForNoThreads(role: UserRole) {
  if (role === 'gm') return 'Create your first thread to give the party a clear hook for session one.';
  if (role === 'helper_gm') return 'Coordinate with your GM by drafting a support thread the players can discover.';
  return 'No threads are visible yet; check back after your GM shares a thread for your character.';
}

function sentenceForNoTimelineEvents(role: UserRole) {
  if (role === 'gm') return 'Add a starting event at Now so players have immediate context and momentum.';
  if (role === 'helper_gm') return 'Add a supporting timeline beat to reinforce the opening situation.';
  return 'No timeline beats are visible yet; new events appear here as the story progresses.';
}

function sentenceForFetchFailure(role: UserRole) {
  if (role === 'gm') return 'We could not load campaign data; retry so you can continue preparing this session.';
  if (role === 'helper_gm') return 'We could not sync shared campaign data; retry and continue assisting your GM.';
  return 'We could not load your campaign view; retry to rejoin the ongoing story.';
}

export function NoThreadsEmptyState({ role, onPrimaryAction }: RoleAwareEmptyStateProps) {
  return (
    <section aria-label="No threads available">
      <h3>No threads available</h3>
      <p>{sentenceForNoThreads(role)}</p>
      <button type="button" onClick={onPrimaryAction}>
        {role === 'player' ? 'Refresh Threads' : 'Create Thread'}
      </button>
    </section>
  );
}

export function NoTimelineEventsEmptyState({ role, onPrimaryAction }: RoleAwareEmptyStateProps) {
  return (
    <section aria-label="No timeline events">
      <h3>No timeline events</h3>
      <p>{sentenceForNoTimelineEvents(role)}</p>
      <button type="button" onClick={onPrimaryAction}>
        {role === 'player' ? 'Refresh Timeline' : 'Add Timeline Event'}
      </button>
    </section>
  );
}

export function FailedFetchEmptyState({ role, onPrimaryAction }: RoleAwareEmptyStateProps) {
  return (
    <section aria-label="Failed fetch">
      <h3>We hit a loading error</h3>
      <p>{sentenceForFetchFailure(role)}</p>
      <button type="button" onClick={onPrimaryAction}>
        Retry
      </button>
      <small>Current role: {ROLE_LABELS[role]}</small>
    </section>
  );
}
