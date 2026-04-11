import '@xyflow/react/dist/style.css';
import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AuthProvider } from '@/contexts/auth-context';

export const metadata: Metadata = {
  title: 'Roleplay MVP',
  description: 'Frontend MVP for roleplaying event and connection system.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
