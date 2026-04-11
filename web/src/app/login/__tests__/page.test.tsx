import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '../page';

const { mockApiLogin, mockPush, mockStoreSession } = vi.hoisted(() => ({
  mockApiLogin: vi.fn(),
  mockPush: vi.fn(),
  mockStoreSession: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    login: mockStoreSession
  })
}));

vi.mock('@/lib/api', () => ({
  LOGIN_ERROR_INVALID_CREDENTIALS: 'LOGIN_ERROR_INVALID_CREDENTIALS',
  api: {
    login: mockApiLogin
  }
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('Login page route', () => {
  beforeEach(() => {
    mockApiLogin.mockReset();
    mockPush.mockReset();
    mockStoreSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders username and password controls', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('stores the session and redirects after a successful login', async () => {
    const user = userEvent.setup();

    mockApiLogin.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      role: 'gm'
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Username'), ' Alice ');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockStoreSession).toHaveBeenCalledWith({
        role: 'gm',
        username: 'alice',
        userId: 'user-1'
      });
    });

    expect(mockApiLogin).toHaveBeenCalledWith('alice', 'secret');
    expect(mockPush).toHaveBeenCalledWith('/project');
  });

  it('shows a loading state and disables submit while the login is pending', async () => {
    const user = userEvent.setup();
    const pendingLogin = deferred<{ id: string; username: string; role: string }>();

    mockApiLogin.mockReturnValueOnce(pendingLogin.promise);

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    });

    pendingLogin.resolve({
      id: 'user-1',
      username: 'alice',
      role: 'player'
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/project');
    });
  });

  it('shows an inline error when login fails with invalid credentials', async () => {
    const user = userEvent.setup();

    mockApiLogin.mockRejectedValueOnce(new Error('LOGIN_ERROR_INVALID_CREDENTIALS'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(mockStoreSession).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows an API availability message for non-auth login failures', async () => {
    const user = userEvent.setup();

    mockApiLogin.mockRejectedValueOnce(new Error('network failed'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the API. Make sure the backend is running on http://localhost:3001.'
    );
    expect(mockStoreSession).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
