'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/contexts/role-context';

const navItems = [
  { href: '/project', label: 'Project' },
  { href: '/threads', label: 'Threads' },
  { href: '/timeline', label: 'Timeline' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();

  if (pathname === '/login') {
    return <main className="page-container">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 className="sidebar-title">MVP</h2>
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
          <div>Project: Roleplaying Event System</div>
          <div>Role: {role}</div>
        </header>
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
