export type UserRole = 'gm' | 'helper' | 'player';

export interface DemoProjectOption {
  id: string;
  name: string;
  description?: string;
}

export interface OnboardingSetup {
  role: UserRole;
  demoProjectId: string;
  completedAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  gm: 'GM',
  helper: 'Helper GM',
  player: 'Player',
};
