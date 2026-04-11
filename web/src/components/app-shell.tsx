'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getRoleLabel } from '@/lib/roles';

const navItems = [
  { href: '/project', label: 'Project' },
  { href: '/threads', label: 'Threads' },
  { href: '/timeline', label: 'Timeline' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useAuth();
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
            return (
              <Link key={item.href} href={item.href} className={isActive ? 'nav-link active' : 'nav-link'}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="content-region">
        <header className="top-bar">
          <div>Roleplaying Event System</div>
          <div>Role: {getRoleLabel(role)}</div>
        </header>
        <main className={pageContainerClassName}>{children}</main>
      </div>
    </div>
  );
}
