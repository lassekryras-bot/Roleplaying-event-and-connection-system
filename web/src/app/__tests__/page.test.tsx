import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('HomePage route guard', () => {
  it('redirects to /project immediately', async () => {
    const { default: HomePage } = await import('../page');

    HomePage();

    expect(redirect).toHaveBeenCalledWith('/project');
  });
});
