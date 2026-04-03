import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VisibilityGuard } from '../VisibilityGuard';

function GmTruth() {
  return <div data-testid="gm-truth">Top-secret GM truth</div>;
}

describe('VisibilityGuard', () => {
  it('shows role badge text for PLAYER', () => {
    render(
      <VisibilityGuard role="PLAYER" showDetailPageNote>
        <div>Public content</div>
      </VisibilityGuard>,
    );

    expect(screen.getByTestId('viewer-role-badge')).toHaveTextContent('Viewing as PLAYER');
    expect(screen.getByTestId('player-gm-hidden-note')).toHaveTextContent(
      'Some GM-only details are hidden.',
    );
  });

  it('never renders gm-only blocks for PLAYER even if gmOnly prop is provided', () => {
    render(
      <VisibilityGuard role="PLAYER" gmOnly={<GmTruth />}>
        <div>Public content</div>
      </VisibilityGuard>,
    );

    expect(screen.queryByTestId('gm-only-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gm-truth')).not.toBeInTheDocument();
  });

  it('renders gm-only blocks for GM and HELPER_GM', () => {
    const { rerender } = render(
      <VisibilityGuard role="GM" gmOnly={<GmTruth />}>
        <div>Public content</div>
      </VisibilityGuard>,
    );

    expect(screen.getByTestId('gm-truth')).toBeInTheDocument();

    rerender(
      <VisibilityGuard role="HELPER_GM" gmOnly={<GmTruth />}>
        <div>Public content</div>
      </VisibilityGuard>,
    );

    expect(screen.getByTestId('gm-truth')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-role-badge')).toHaveTextContent('Viewing as HELPER_GM');
  });
});
