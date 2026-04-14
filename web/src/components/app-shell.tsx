'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Select } from '@/components/ui';
import { useAuth } from '@/contexts/auth-context';
import { CampaignSelectionProvider, useCampaignSelection } from '@/contexts/campaign-selection-context';
import { getRoleLabel } from '@/lib/roles';

const navItems = [
  { href: '/project', label: 'Project' },
  { href: '/player-characters', label: 'Player Characters' },
  { href: '/threads', label: 'Threads' },
  { href: '/timeline', label: 'Timeline' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CampaignSelectionProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </CampaignSelectionProvider>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const { buildCampaignHref, projectOptions, selectProject, selectedProjectId, selectionReady } = useCampaignSelection();
  const isWidePage = pathname === '/project' || pathname === '/timeline';
  const pageContainerClassName = isWidePage ? 'page-container page-container--wide' : 'page-container';

  if (pathname === '/login') {
    return <main className="page-container">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 className="sidebar-title">Roleplay System</h2>
        <nav>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const href = buildCampaignHref(item.href);
            return (
              <Link key={item.href} href={href} className={isActive ? 'nav-link active' : 'nav-link'}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="content-region">
        <header className="top-bar">
          <div className="top-bar-brand">
            <div className="top-bar-title">Roleplaying Event System</div>
          </div>
          <div className="top-bar-actions">
            <label className="top-bar-field">
              <span className="top-bar-field-label">Campaign</span>
              <Select
                aria-label="global campaign selector"
                className="top-bar-select"
                value={selectedProjectId}
                disabled={!selectionReady || projectOptions.length === 0}
                onChange={(event) => {
                  void selectProject(event.target.value);
                }}
              >
                {projectOptions.length === 0 ? <option value="">No campaigns</option> : null}
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="top-bar-meta">Role: {getRoleLabel(role)}</div>
          </div>
        </header>
        <main className={pageContainerClassName}>{children}</main>
      </div>
    </div>
  );
}
