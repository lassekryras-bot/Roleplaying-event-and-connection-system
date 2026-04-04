export const CANONICAL_THREAD_STATES = ['dormant', 'active', 'escalated', 'resolved'] as const;

export type DomainThreadState = (typeof CANONICAL_THREAD_STATES)[number];
export type UiThreadStatus = 'open' | 'in_progress' | 'resolved';

const domainToUiStatusMap: Record<DomainThreadState, UiThreadStatus> = {
  dormant: 'open',
  active: 'in_progress',
  escalated: 'in_progress',
  resolved: 'resolved'
};

const uiToDomainStateMap: Record<UiThreadStatus, DomainThreadState> = {
  open: 'dormant',
  in_progress: 'active',
  resolved: 'resolved'
};

export function assertDomainThreadState(state: string): DomainThreadState {
  if ((CANONICAL_THREAD_STATES as readonly string[]).includes(state)) {
    return state as DomainThreadState;
  }

  throw new Error(`Invalid domain thread state: ${state}`);
}

export function toUiThreadStatus(state: string): UiThreadStatus {
  const canonicalState = assertDomainThreadState(state);
  return domainToUiStatusMap[canonicalState];
}

export function toDomainThreadState(status: string): DomainThreadState {
  if (status in uiToDomainStateMap) {
    return uiToDomainStateMap[status as UiThreadStatus];
  }

  throw new Error(`Invalid UI thread status: ${status}`);
}
