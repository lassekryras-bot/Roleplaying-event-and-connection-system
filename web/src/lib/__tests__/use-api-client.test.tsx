import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApiClient } from '../use-api-client';

const { mockAuthSession } = vi.hoisted(() => ({
  mockAuthSession: {
    role: 'helper',
    userId: 'helper-1'
  }
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockAuthSession
}));

function ApiClientConsumer() {
  const { getThreads } = useApiClient();

  return (
    <button type="button" onClick={() => void getThreads()}>
      Load threads
    </button>
  );
}

describe('useApiClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => []
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes x-role and x-user-id headers for authenticated requests after login', async () => {
    render(<ApiClientConsumer />);

    fireEvent.click(screen.getByRole('button', { name: 'Load threads' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/threads', {
        headers: {
          'content-type': 'application/json',
          'x-role': 'HELPER',
          'x-user-id': 'helper-1'
        },
        cache: 'no-store'
      });
    });
  });
});
