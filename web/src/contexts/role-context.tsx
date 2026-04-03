'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_ROLE = 'player';

type RoleContextValue = {
  role: string;
  setRole: (role: string) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string>(DEFAULT_ROLE);

  useEffect(() => {
    const stored = window.localStorage.getItem('mvp-role');
    if (stored) {
      setRole(stored);
    }
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole: (nextRole: string) => {
        setRole(nextRole);
        window.localStorage.setItem('mvp-role', nextRole);
      }
    }),
    [role]
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
