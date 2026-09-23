import { describe, expect, it, vi } from 'vitest';
import { pageIdentity } from '@/backend/auth/page-session';
import Page from '@/app/[[...page]]/page';
import { userRoles } from '@/shared/contracts/permissions';
vi.mock('@/backend/auth/page-session', () => ({
  pageIdentity: vi.fn(),
  pageSessionCookie: 'test-session',
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('Not found');
  },
}));
vi.mock('@/frontend/components/circle-app', () => ({ CircleApp: () => null }));
describe('server page authorization', () => {
  for (const role of userRoles) {
    it(`checks ${role} before rendering moderation pages`, async () => {
      vi.mocked(pageIdentity).mockResolvedValue({ id: 'actor', role, accountStatus: 'ACTIVE' });
      const page = await Page({ params: Promise.resolve({ page: ['moderation'] }) });
      expect(page.type === 'main').toBe(!['MODERATOR', 'ULTIMATE_MODERATOR'].includes(role));
      const roles = await Page({ params: Promise.resolve({ page: ['moderation', 'roles'] }) });
      expect(roles.type === 'main').toBe(role !== 'ULTIMATE_MODERATOR');
    });
  }
  it('denies unauthenticated and suspended sessions', async () => {
    vi.mocked(pageIdentity).mockRejectedValue(new Error('No session'));
    expect((await Page({ params: Promise.resolve({ page: ['moderation'] }) })).type).toBe('main');
    vi.mocked(pageIdentity).mockResolvedValue({
      id: 'actor',
      role: 'ULTIMATE_MODERATOR',
      accountStatus: 'SUSPENDED',
    });
    expect((await Page({ params: Promise.resolve({ page: ['moderation', 'roles'] }) })).type).toBe(
      'main',
    );
  });
});
