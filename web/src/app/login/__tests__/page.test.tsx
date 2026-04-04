import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from '../page';
import { RoleProvider } from '@/contexts/role-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('Login page route', () => {
  it('renders the app route component with role selection controls', () => {
    render(
      <RoleProvider>
        <LoginPage />
      </RoleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Role selection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});
