import { describe, expect, it } from 'vitest';

import {
  canPreviewPlayerMode,
  canViewGmContent,
  getRoleLabel,
  normalizeFrontendRole,
  toApiRole,
} from '../roles';

describe('roles helpers', () => {
  it('normalizes legacy helper role values to helper', () => {
    expect(normalizeFrontendRole('HELPER')).toBe('helper');
    expect(normalizeFrontendRole('helper_gm')).toBe('helper');
    expect(normalizeFrontendRole('Helper-GM')).toBe('helper');
  });

  it('reports GM privileges for gm and helper roles only', () => {
    expect(canViewGmContent('gm')).toBe(true);
    expect(canViewGmContent('helper')).toBe(true);
    expect(canViewGmContent('player')).toBe(false);
    expect(canPreviewPlayerMode('helper')).toBe(true);
  });

  it('maps normalized roles to user-facing labels and API headers', () => {
    expect(getRoleLabel('helper')).toBe('Helper GM');
    expect(getRoleLabel('')).toBe('Guest');
    expect(toApiRole('gm')).toBe('GM');
    expect(toApiRole('helper')).toBe('HELPER');
    expect(toApiRole('player')).toBe('PLAYER');
  });
});
