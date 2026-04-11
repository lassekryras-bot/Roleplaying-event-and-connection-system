'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { normalizeFrontendRole } from '@/lib/roles';

export const AUTH_SESSION_STORAGE_KEY = 'mvp-auth-session';
const LEGACY_SESSION_STORAGE_KEY = 'mvp-session';

export type AuthSession = {
  userId: string;
  username: string;
  role: string;
};

type AuthContextValue = AuthSession & {
  isAuthenticated: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
};

const EMPTY_SESSION: AuthSession = {
  userId: '',
  username: '',
  role: ''
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeSession(session: Partial<AuthSession>): AuthSession | null {
  const userId = typeof session.userId === 'string' ? session.userId.trim() : '';
  const username = typeof session.username === 'string' ? session.username.trim() : '';
  const role = normalizeFrontendRole(session.role);

  if (userId.length === 0 || username.length === 0 || role.length === 0) {
    return null;
  }

  return {
    userId,
    username,
    role
  };
}

function readStoredSession(storageKey: string): AuthSession | null {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(stored) as Partial<AuthSession>);
  } catch {
    return null;
  }
}

function clearStoredSessions() {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(EMPTY_SESSION);

  useEffect(() => {
    const storedSession = readStoredSession(AUTH_SESSION_STORAGE_KEY);
    if (storedSession) {
      window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
      setSession(storedSession);
      return;
    }

    const legacySession = readStoredSession(LEGACY_SESSION_STORAGE_KEY);
    if (legacySession) {
      setSession(legacySession);
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(legacySession));
    }

    window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    if (!storedSession && !legacySession) {
      clearStoredSessions();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isAuthenticated: session.userId.length > 0,
      login: (nextSession: AuthSession) => {
        const normalizedSession = normalizeSession(nextSession);
        if (!normalizedSession) {
          return;
        }

        setSession(normalizedSession);
        window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
      },
      logout: () => {
        setSession(EMPTY_SESSION);
        clearStoredSessions();
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
