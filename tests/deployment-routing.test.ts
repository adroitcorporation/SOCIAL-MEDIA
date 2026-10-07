import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../next.config';
import { createRequire } from 'node:module';

const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp');

afterEach(() => vi.unstubAllEnvs());

describe('frontend to backend routing', () => {
  it('sets production browser security headers without development eval permissions', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const rules = await config.headers!();
    expect(rules[0].source).toBe('/(.*)');
    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-eval');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(config.poweredByHeader).toBe(false);
  });
  it('forwards production Vercel API routes before matching local handlers', async () => {
    vi.stubEnv('BACKEND_URL', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await config.rewrites!()).toEqual({
      beforeFiles: [
        {
          source: '/api/:path((?!config(?:/|$)).*)',
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
        {
          source: '/api/:path((?!config(?:/|$)).*)',
          destination: 'https://backend.example.test/api/:path*',
        },
      ],
    });
  });

  it('keeps startup config local while proxying protected APIs and live updates', async () => {
    vi.stubEnv('BACKEND_URL', 'https://backend.example.test');
    const rewrites = await config.rewrites!();
    if (Array.isArray(rewrites)) throw new Error('Expected phased rewrites');
    const rewrite = rewrites.beforeFiles?.[0];
    if (!rewrite) throw new Error('Expected a backend rewrite');
    const matcher = pathToRegexp(rewrite.source);
    for (const path of ['/api/config', '/api/config/']) expect(matcher.test(path)).toBe(false);
    for (const path of ['/api/session', '/api/live', '/api/conversations/123/messages'])
      expect(matcher.test(path)).toBe(true);
  });
});
