import { describe, expect, it } from 'vitest';

import {
  assertDomainThreadState,
  toDomainThreadState,
  toUiThreadStatus
} from '@/lib/thread-state';

describe('thread state mapping', () => {
  it('maps canonical domain states to friendly UI labels', () => {
    expect(toUiThreadStatus('dormant')).toBe('open');
    expect(toUiThreadStatus('active')).toBe('in_progress');
    expect(toUiThreadStatus('escalated')).toBe('in_progress');
    expect(toUiThreadStatus('resolved')).toBe('resolved');
  });

  it('maps UI labels back to canonical domain states', () => {
    expect(toDomainThreadState('open')).toBe('dormant');
    expect(toDomainThreadState('in_progress')).toBe('active');
    expect(toDomainThreadState('resolved')).toBe('resolved');
  });

  it('rejects invalid domain states', () => {
    expect(() => assertDomainThreadState('open')).toThrow('Invalid domain thread state: open');
  });

  it('rejects invalid UI labels', () => {
    expect(() => toDomainThreadState('escalated')).toThrow('Invalid UI thread status: escalated');
  });
});
