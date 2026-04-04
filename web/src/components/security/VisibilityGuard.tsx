import type { ReactNode } from 'react';
import React from 'react';

export type UserRole = 'PLAYER' | 'GM' | 'HELPER_GM';

interface VisibilityGuardProps {
  role: UserRole;
  children: ReactNode;
  gmOnly?: ReactNode;
  showDetailPageNote?: boolean;
  className?: string;
}

const GM_ELIGIBLE_ROLES: ReadonlySet<UserRole> = new Set(['GM', 'HELPER_GM']);

export function VisibilityGuard({
  role,
  children,
  gmOnly,
  showDetailPageNote = false,
  className,
}: VisibilityGuardProps) {
  const canViewGmBlocks = GM_ELIGIBLE_ROLES.has(role);

  return (
    <section className={className} data-testid="visibility-guard">
      <header>
        <span
          aria-label="viewer-role-badge"
          data-testid="viewer-role-badge"
          style={{
            display: 'inline-block',
            borderRadius: 999,
            padding: '0.2rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            backgroundColor: '#e8f1ff',
            color: '#0a3d8f',
          }}
        >
          {`Viewing as ${role}`}
        </span>
      </header>

      <div data-testid="shared-content">{children}</div>

      {canViewGmBlocks ? <div data-testid="gm-only-content">{gmOnly}</div> : null}

      {role === 'PLAYER' && showDetailPageNote ? (
        <p
          data-testid="player-gm-hidden-note"
          style={{ marginTop: '0.75rem', color: '#37506b', fontSize: '0.9rem' }}
        >
          Some GM-only details are hidden.
        </p>
      ) : null}
    </section>
  );
}
