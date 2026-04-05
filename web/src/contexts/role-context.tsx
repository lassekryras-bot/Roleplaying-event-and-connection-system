'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';

type RoleContextValue = {
  role: string;
  username: string;
  userId: string;
  setSession: (session: { role: string; username: string; userId: string }) => void;
};

const DEFAULT_SESSION = {
  role: 'player',
  username: '',
  userId: ''
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string>(DEFAULT_SESSION.role);
  const [username, setUsername] = useState<string>(DEFAULT_SESSION.username);
  const [userId, setUserId] = useState<string>(DEFAULT_SESSION.userId);

  useEffect(() => {
    const stored = window.localStorage.getItem('mvp-session');
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<typeof DEFAULT_SESSION>;
      setRole(typeof parsed.role === 'string' ? parsed.role : DEFAULT_SESSION.role);
      setUsername(typeof parsed.username === 'string' ? parsed.username : DEFAULT_SESSION.username);
      setUserId(typeof parsed.userId === 'string' ? parsed.userId : DEFAULT_SESSION.userId);
    } catch {
      window.localStorage.removeItem('mvp-session');
    }
  }, []);

  const value = useMemo(
    () => ({
      role,
      username,
      userId,
      setSession: (nextSession: { role: string; username: string; userId: string }) => {
        setRole(nextSession.role);
        setUsername(nextSession.username);
        setUserId(nextSession.userId);
        window.localStorage.setItem('mvp-session', JSON.stringify(nextSession));
      }
    }),
    [role, username, userId]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }

  return context;
}
