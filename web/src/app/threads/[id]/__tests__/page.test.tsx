import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ThreadDetailPage from '../page';

const mockUseApiClient = vi.fn();

vi.mock('@/lib/use-api-client', () => ({
  useApiClient: () => mockUseApiClient(),
}));

afterEach(() => {
  cleanup();
});

describe('Thread detail role-safe rendering', () => {
  beforeEach(() => {
    mockUseApiClient.mockReset();
  });

  it('renders gm truth for GM role', async () => {
    mockUseApiClient.mockReturnValue({
      role: 'gm',
      getThreadById: vi.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Whispers in the harbor',
        player_summary: 'Dockworkers have gone missing at night.',
        gm_truth: 'The harbor master is secretly paid by the antagonist.',
        messages: [],
      }),
    });

    render(<ThreadDetailPage params={Promise.resolve({ id: 'thread-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Whispers in the harbor')).toBeInTheDocument();
    });

    expect(screen.getByText('Dockworkers have gone missing at night.')).toBeInTheDocument();
    expect(
      screen.getByText('GM Truth: The harbor master is secretly paid by the antagonist.'),
    ).toBeInTheDocument();
  });

  it('does not render gm truth for PLAYER role on the same thread ID', async () => {
    mockUseApiClient.mockReturnValue({
      role: 'player',
      getThreadById: vi.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Whispers in the harbor',
        player_summary: 'Dockworkers have gone missing at night.',
        gm_truth: 'The harbor master is secretly paid by the antagonist.',
        messages: [],
      }),
    });

    render(<ThreadDetailPage params={Promise.resolve({ id: 'thread-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Whispers in the harbor')).toBeInTheDocument();
    });

    expect(screen.getByText('Dockworkers have gone missing at night.')).toBeInTheDocument();
    expect(screen.queryByText(/GM Truth:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secretly paid by the antagonist/)).not.toBeInTheDocument();
  });
});
