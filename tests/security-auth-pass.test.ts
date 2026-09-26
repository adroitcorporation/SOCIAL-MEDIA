import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '@/backend/auth/session';
import { browserAuth } from '@/frontend/auth/browser-auth';
import { validateMutationRequest } from '@/backend/http/middleware';

// Provider and persistence doubles: these tests do not exercise live Supabase.
const doubles = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsert: vi.fn(),
  findUnique: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: doubles.getUser } }),
}));
vi.mock('@/backend/database/client', () => ({
  db: { user: { upsert: doubles.upsert, findUnique: doubles.findUnique } },
}));
vi.mock('@/frontend/auth/supabase-browser', () => ({ authClient: () => ({ auth: doubles }) }));
const actor = {
  id: 'synthetic',
  name: 'Synthetic student',
  role: 'STUDENT',
  accountStatus: 'ACTIVE',
};
const request = () =>
  new Request('http://localhost/api/state', {
    headers: { authorization: 'Bearer synthetic-token' },
  });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LOCAL_DEMO', 'false');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:9');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-test-key');
  vi.stubEnv('APP_URL', 'http://localhost');
  doubles.findUnique.mockResolvedValue(actor);
  doubles.upsert.mockResolvedValue(actor);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe('real authentication function with mocked Supabase provider', () => {
  it('does not rewrite or reread an unchanged verified profile and still checks current account status', async () => {
    const verified = { ...actor, emailVerified: true, collegeVerified: true };
    doubles.findUnique.mockResolvedValue(verified);
    doubles.getUser.mockResolvedValue({
      data: {
        user: { id: actor.id, email: 'person@lnmiit.ac.in', email_confirmed_at: '2026-01-01' },
      },
      error: null,
    });
    expect(await authenticate(request())).toEqual(verified);
    expect(doubles.findUnique).toHaveBeenCalledOnce();
    expect(doubles.upsert).not.toHaveBeenCalled();
    doubles.findUnique.mockResolvedValue({ ...verified, accountStatus: 'SUSPENDED' });
    await expect(authenticate(request())).rejects.toMatchObject({ status: 403 });
    expect(doubles.getUser).toHaveBeenCalledTimes(2);
  });
  it.each(['person@example.com', 'person@lnmiit.ac.in.attacker.test'])(
    'rejects confirmed foreign address %s',
    async (email) => {
      doubles.getUser.mockResolvedValue({
        data: { user: { id: actor.id, email, email_confirmed_at: '2026-01-01' } },
        error: null,
      });
      await expect(authenticate(request())).rejects.toMatchObject({ status: 403 });
      expect(doubles.upsert).not.toHaveBeenCalled();
    },
  );
  it('rejects unconfirmed LNMIIT email', async () => {
    doubles.getUser.mockResolvedValue({
      data: { user: { id: actor.id, email: 'person@lnmiit.ac.in', email_confirmed_at: null } },
      error: null,
    });
    await expect(authenticate(request())).rejects.toMatchObject({ status: 403 });
    expect(doubles.upsert).not.toHaveBeenCalled();
  });
  it('automatically verifies confirmed LNMIIT email without trusting role metadata', async () => {
    doubles.getUser.mockResolvedValue({
      data: {
        user: {
          id: actor.id,
          email: 'person@lnmiit.ac.in',
          email_confirmed_at: '2026-01-01',
          user_metadata: { role: 'ULTIMATE_MODERATOR' },
        },
      },
      error: null,
    });
    expect(await authenticate(request())).toEqual(actor);
    expect(doubles.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { emailVerified: true, collegeVerified: true },
        create: { id: actor.id, name: 'New student', emailVerified: true, collegeVerified: true },
      }),
    );
  });
  it.each(['SUSPENDED', 'BANNED', 'RESTRICTED', 'DEACTIVATED'])(
    'denies %s despite a valid provider identity',
    async (accountStatus) => {
      doubles.getUser.mockResolvedValue({
        data: {
          user: { id: actor.id, email: 'person@lnmiit.ac.in', email_confirmed_at: '2026-01-01' },
        },
        error: null,
      });
      doubles.findUnique.mockResolvedValue({ ...actor, accountStatus });
      await expect(authenticate(request())).rejects.toMatchObject({ status: 403 });
      expect(doubles.upsert.mock.calls[0][0].update).not.toHaveProperty('accountStatus');
    },
  );
  it('rejects missing, invalid and overlong bearer tokens', async () => {
    await expect(authenticate(new Request('http://localhost'))).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      authenticate(
        new Request('http://localhost', {
          headers: { authorization: `Bearer ${'x'.repeat(8192)}` },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(doubles.getUser).not.toHaveBeenCalled();
    doubles.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });
    await expect(authenticate(request())).rejects.toMatchObject({ status: 401 });
  });
});
describe('browser provider adapter and origin validation', () => {
  it('uses same-origin confirmation and password-recovery destinations', async () => {
    doubles.signUp.mockResolvedValue({ data: { session: null }, error: null });
    doubles.resetPasswordForEmail.mockResolvedValue({ error: null });
    await browserAuth.signUp('test@lnmiit.ac.in', 'synthetic-password', 'http://localhost:3000');
    await browserAuth.requestPasswordReset('test@lnmiit.ac.in', 'http://localhost:3000');
    expect(doubles.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { emailRedirectTo: 'http://localhost:3000/' } }),
    );
    expect(doubles.resetPasswordForEmail).toHaveBeenCalledWith('test@lnmiit.ac.in', {
      redirectTo: 'http://localhost:3000/reset-password',
    });
  });
  it('signs out through the provider and surfaces failures', async () => {
    doubles.signOut
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Synthetic signout error') });
    await browserAuth.signOut();
    await expect(browserAuth.signOut()).rejects.toThrow('Synthetic signout error');
  });
  it('rejects foreign origins and non-JSON mutation bodies', () => {
    expect(() =>
      validateMutationRequest(
        new Request('http://localhost/api/profile', {
          headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
        }),
      ),
    ).toThrow('Invalid request origin');
    expect(() =>
      validateMutationRequest(
        new Request('http://localhost/api/profile', {
          headers: { origin: 'http://localhost', 'content-type': 'text/plain' },
        }),
      ),
    ).toThrow('Send JSON');
    expect(() =>
      validateMutationRequest(
        new Request('http://localhost/api/profile', {
          headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        }),
      ),
    ).not.toThrow();
  });
});
