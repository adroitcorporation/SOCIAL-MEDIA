import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST, DELETE } from '@/backend/http/page-session-handler';
import { pageIdentity } from '@/backend/auth/page-session';
import { AppError } from '@/backend/utils/errors';
vi.mock('@/backend/auth/page-session', () => ({
  pageIdentity: vi.fn(),
  pageSessionCookie: 'circle-page-session',
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe('page session bridge', () => {
  const request = (origin = 'https://circle.example') =>
    new Request('https://circle.example/session', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        authorization: 'Bearer trusted-token',
      },
      body: '{}',
    });
  it('validates identity and sets a secure HttpOnly cookie without frontend APP_URL configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_URL', '');
    vi.mocked(pageIdentity).mockResolvedValue({
      id: 'actor',
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(pageIdentity).toHaveBeenCalledWith('trusted-token');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax'])
      expect(response.headers.get('set-cookie')).toContain(flag);
  });
  it('does not set a session when identity verification fails', async () => {
    vi.mocked(pageIdentity).mockRejectedValue(new AppError(403, 'Account suspended.'));
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('rejects cross-origin session mutations and clears the cookie on logout', async () => {
    expect((await POST(request('https://other.example'))).status).toBe(403);
    expect((await DELETE(request('https://other.example'))).status).toBe(403);
    expect(pageIdentity).not.toHaveBeenCalled();
    const response = await DELETE(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
  });
});
