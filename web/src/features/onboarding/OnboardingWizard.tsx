import { useMemo, useState, type ReactNode } from 'react';
import { ROLE_LABELS, type DemoProjectOption, type OnboardingSetup, type UserRole } from './types';

interface OnboardingWizardProps {
  demoProjects: DemoProjectOption[];
  onComplete: (setup: OnboardingSetup) => void;
  onViewThreads: () => void;
  onOpenTimeline: () => void;
}

const ROLE_OPTIONS: UserRole[] = ['gm', 'helper', 'player'];

export function OnboardingWizard({
  demoProjects,
  onComplete,
  onViewThreads,
  onOpenTimeline,
}: OnboardingWizardProps) {
  const [role, setRole] = useState<UserRole>('gm');
  const [demoProjectId, setDemoProjectId] = useState<string>(demoProjects[0]?.id ?? '');

  const canComplete = useMemo(() => Boolean(role && demoProjectId), [role, demoProjectId]);

  const handleComplete = () => {
    if (!canComplete) {
      return;
    }

    onComplete({
      role,
      demoProjectId,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <section aria-label="First-run setup wizard">
      <h2>Welcome to your first session setup</h2>

      <ol>
        <li>
          <h3>1. Choose role</h3>
          <div role="radiogroup" aria-label="Select your role">
            {ROLE_OPTIONS.map((roleOption) => (
              <label key={roleOption} style={{ display: 'block', marginBottom: 8 }}>
                <input
                  type="radio"
                  name="role"
                  value={roleOption}
                  checked={roleOption === role}
                  onChange={() => setRole(roleOption)}
                />
                {ROLE_LABELS[roleOption]}
              </label>
            ))}
          </div>
        </li>

        <li>
          <h3>2. Choose demo project</h3>
          <label>
            Demo project
            <select value={demoProjectId} onChange={(event) => setDemoProjectId(event.target.value)}>
              {demoProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </li>

        <li>
          <h3>3. Continue</h3>
          <button type="button" onClick={handleComplete} disabled={!canComplete}>
            Finish setup
          </button>
        </li>
      </ol>

      <div aria-label="Quick actions" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onViewThreads}>
          View Threads
        </button>
        <button type="button" onClick={onOpenTimeline}>
          Open Timeline
        </button>
      </div>
    </section>
  );
}

interface FirstRunGateProps {
  children: ReactNode;
  hasCompletedOnboarding: boolean;
  demoProjects: DemoProjectOption[];
  onComplete: (setup: OnboardingSetup) => void;
  onViewThreads: () => void;
  onOpenTimeline: () => void;
}

export function FirstRunGate({
  children,
  hasCompletedOnboarding,
  demoProjects,
  onComplete,
  onViewThreads,
  onOpenTimeline,
}: FirstRunGateProps) {
  if (!hasCompletedOnboarding) {
    return (
      <OnboardingWizard
        demoProjects={demoProjects}
        onComplete={onComplete}
        onViewThreads={onViewThreads}
        onOpenTimeline={onOpenTimeline}
      />
    );
  }

  return <>{children}</>;
}
