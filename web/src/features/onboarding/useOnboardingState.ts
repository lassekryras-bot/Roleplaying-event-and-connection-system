import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnboardingSetup } from './types';

export const ONBOARDING_STORAGE_KEY = 'lce.onboarding.setup.v1';

function parseStoredSetup(rawValue: string | null): OnboardingSetup | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as OnboardingSetup;
  } catch {
    return null;
  }
}

export function getStoredOnboardingSetup(): OnboardingSetup | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return parseStoredSetup(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
}

export function persistOnboardingSetup(setup: OnboardingSetup): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(setup));
}

export function clearOnboardingSetup(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export function useOnboardingState() {
  const [setup, setSetup] = useState<OnboardingSetup | null>(null);

  useEffect(() => {
    setSetup(getStoredOnboardingSetup());
  }, []);

  const completeOnboarding = useCallback((nextSetup: OnboardingSetup) => {
    persistOnboardingSetup(nextSetup);
    setSetup(nextSetup);
  }, []);

  const resetOnboarding = useCallback(() => {
    clearOnboardingSetup();
    setSetup(null);
  }, []);

  const hasCompletedOnboarding = useMemo(() => Boolean(setup), [setup]);

  return {
    setup,
    hasCompletedOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
}
