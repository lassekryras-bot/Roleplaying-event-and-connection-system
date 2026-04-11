import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AUTH_SESSION_STORAGE_KEY, AuthProvider, useAuth } from '../auth-context';

function AuthConsumer() {
  const auth = useAuth();

  return (
    <>
      <div data-testid="auth-state">{auth.isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <div data-testid="user-id">{auth.userId}</div>
      <div data-testid="username">{auth.username}</div>
      <div data-testid="role">{auth.role}</div>
      <button
        type="button"
        onClick={() =>
          auth.login({
            userId: 'user-2',
            username: 'Morgan',
            role: 'Helper_GM'
          })
        }
      >
        Login
      </button>
      <button type="button" onClick={auth.logout}>
        Logout
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AuthProvider', () => {
  it('rehydrates a stored session on mount', async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: 'user-1',
        username: 'Lasse',
        role: 'GM'
      }),
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(screen.getByTestId('username')).toHaveTextContent('Lasse');
    expect(screen.getByTestId('role')).toHaveTextContent('gm');
  });

  it('persists login data and clears it on logout', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    });

    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBe(
      JSON.stringify({
        userId: 'user-2',
        username: 'Morgan',
        role: 'helper'
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
    });

    expect(screen.getByTestId('user-id')).toBeEmptyDOMElement();
    expect(screen.getByTestId('username')).toBeEmptyDOMElement();
    expect(screen.getByTestId('role')).toBeEmptyDOMElement();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});
