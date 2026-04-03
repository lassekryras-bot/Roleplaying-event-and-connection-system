import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { RoleProvider } from '@/contexts/role-context';

export const metadata: Metadata = {
  title: 'Roleplay MVP',
  description: 'Frontend MVP for roleplaying event and connection system.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
