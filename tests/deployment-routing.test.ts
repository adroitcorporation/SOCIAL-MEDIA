import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../next.config';

afterEach(() => vi.unstubAllEnvs());

describe('frontend to backend routing', () => {
  it('forwards production Vercel API routes before matching local handlers', async () => {
    vi.stubEnv('BACKEND_URL', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await config.rewrites!()).toEqual({
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'https://founder-circle-backend.onrender.com/api/:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    });
  });

  it('keeps Render and local API handlers local, avoiding a proxy loop', async () => {
    vi.stubEnv('BACKEND_URL', '');
    vi.stubEnv('VERCEL_ENV', undefined);
    expect(await config.rewrites!()).toEqual({ beforeFiles: [], afterFiles: [], fallback: [] });
  });

  it('allows a backend override for explicitly configured environments', async () => {
    vi.stubEnv('BACKEND_URL', 'https://backend.example.test/');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await config.rewrites!()).toMatchObject({
      beforeFiles: [
        { source: '/api/:path*', destination: 'https://backend.example.test/api/:path*' },
      ],
    });
  });
});
