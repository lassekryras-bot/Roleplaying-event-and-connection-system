import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../app-shell';

const { mockApiClient, mockAuthSession, mockNavigationState, mockReplace } = vi.hoisted(() => ({
  mockApiClient: {
    getProjects: vi.fn(),
    getPreferredProject: vi.fn(),
    savePreferredProject: vi.fn(),
  },
  mockAuthSession: {
    role: 'gm',
    userId: 'gm-1',
    username: 'Admingm',
  },
  mockNavigationState: {
    pathname: '/threads',
    project: null as string | null,
    location: null as string | null,
  },
  mockReplace: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    ...mockAuthSession,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/use-api-client', () => ({
  useApiClient: () => mockApiClient,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockNavigationState.pathname,
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: (key: string) =>
      key === 'project'
        ? mockNavigationState.project
        : key === 'location'
          ? mockNavigationState.location
          : null,
    toString: () => {
      const params = new URLSearchParams();
      if (mockNavigationState.project) {
        params.set('project', mockNavigationState.project);
      }
      if (mockNavigationState.location) {
        params.set('location', mockNavigationState.location);
      }
      return params.toString();
    },
  }),
}));

describe('app shell campaign selection', () => {
  beforeEach(() => {
    mockNavigationState.pathname = '/threads';
    mockNavigationState.project = null;
    mockNavigationState.location = null;
    mockReplace.mockReset();
    mockApiClient.getProjects.mockReset();
    mockApiClient.getPreferredProject.mockReset();
    mockApiClient.savePreferredProject.mockReset();
    mockApiClient.getProjects.mockResolvedValue([
      { id: 'project-1', name: 'Harbor of Whispers', status: 'active' },
      { id: 'project-2', name: 'The Red Signal', status: 'active' },
    ]);
    mockApiClient.getPreferredProject.mockResolvedValue({ project_id: 'project-1' });
    mockApiClient.savePreferredProject.mockImplementation(async (projectId: string) => ({
      project_id: projectId,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the app title, global campaign selector, and role label', async () => {
    render(
      <AppShell>
        <div>Child page</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('global campaign selector')).toBeEnabled();
    });

    expect(screen.getByText('Roleplaying Event System')).toBeInTheDocument();
    expect(screen.getByText('Role: GM')).toBeInTheDocument();
    expect(screen.getByLabelText('global campaign selector')).toHaveValue('project-1');
  });

  it('updates campaign-scoped nav links from the global selector without redirecting non-campaign routes', async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <div>Thread page</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute('href', '/timeline?project=project-1');
    });

    await user.selectOptions(screen.getByLabelText('global campaign selector'), 'project-2');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Project' })).toHaveAttribute('href', '/project?project=project-2');
      expect(screen.getByRole('link', { name: 'Player Characters' })).toHaveAttribute(
        'href',
        '/player-characters?project=project-2',
      );
      expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute('href', '/timeline?project=project-2');
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces the timeline route and clears location when the global campaign changes', async () => {
    const user = userEvent.setup();
    mockNavigationState.pathname = '/timeline';
    mockNavigationState.project = 'project-1';
    mockNavigationState.location = 'location-grand-archive';

    render(
      <AppShell>
        <div>Timeline page</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('global campaign selector')).toHaveValue('project-1');
    });

    await user.selectOptions(screen.getByLabelText('global campaign selector'), 'project-2');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/timeline?project=project-2');
    });
  });

  it('routes player-character detail pages back to the campaign list when the global campaign changes', async () => {
    const user = userEvent.setup();
    mockNavigationState.pathname = '/player-characters/pc-raina-kestrel';
    mockNavigationState.project = 'project-1';

    render(
      <AppShell>
        <div>Character detail</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('global campaign selector')).toHaveValue('project-1');
    });

    await user.selectOptions(screen.getByLabelText('global campaign selector'), 'project-2');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/player-characters?project=project-2');
    });
  });
});
