import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/config/route';

vi.mock('@/backend/database/client', () => {
  throw new Error('Public startup config must not import the database');
});
vi.mock('@/backend/auth/session', () => {
  throw new Error('Public startup config must not import authentication');
});
vi.mock('@/backend/http/middleware', () => {
  throw new Error('Public startup config must not import rate limiting');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public startup config', () => {
  it('returns only public flags in production without contacting an unavailable backend', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOCAL_DEMO', 'true');
    vi.stubEnv('BACKEND_URL', 'https://unavailable.example');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    const fetch = vi.fn(() => {
      throw new Error('Backend unavailable');
    });
    vi.stubGlobal('fetch', fetch);
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ demo: false, configured: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])(
    'reports unconfigured instead of a 429 when %s is missing',
    async (key) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
      vi.stubEnv(key, '');
      const response = GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ demo: false, configured: false });
    },
  );

  it('preserves explicitly enabled local demo mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOCAL_DEMO', 'true');
    expect((await GET().json()).demo).toBe(true);
  });
});
