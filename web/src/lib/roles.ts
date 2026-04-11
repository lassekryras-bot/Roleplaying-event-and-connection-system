export const FRONTEND_ROLES = ['gm', 'helper', 'player'] as const;

export type FrontendRole = (typeof FRONTEND_ROLES)[number];
export type FrontendRoleOrGuest = FrontendRole | '';

const ROLE_ALIASES: Record<string, FrontendRole> = {
  gm: 'gm',
  game_master: 'gm',
  helper: 'helper',
  helper_gm: 'helper',
  player: 'player',
};

const ROLE_LABELS: Record<FrontendRole, string> = {
  gm: 'GM',
  helper: 'Helper GM',
  player: 'Player',
};

const API_ROLE_MAP: Record<FrontendRole, string> = {
  gm: 'GM',
  helper: 'HELPER',
  player: 'PLAYER',
};

export function normalizeFrontendRole(role: unknown): FrontendRoleOrGuest {
  if (typeof role !== 'string') {
    return '';
  }

  const normalizedRole = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[normalizedRole] ?? '';
}

export function getRoleLabel(role: unknown): string {
  const normalizedRole = normalizeFrontendRole(role);
  return normalizedRole ? ROLE_LABELS[normalizedRole] : 'Guest';
}

export function canViewGmContent(role: unknown): boolean {
  const normalizedRole = normalizeFrontendRole(role);
  return normalizedRole === 'gm' || normalizedRole === 'helper';
}

export function canPreviewPlayerMode(role: unknown): boolean {
  return canViewGmContent(role);
}

export function toApiRole(role: unknown): string {
  const normalizedRole = normalizeFrontendRole(role);
  return normalizedRole ? API_ROLE_MAP[normalizedRole] : '';
}
