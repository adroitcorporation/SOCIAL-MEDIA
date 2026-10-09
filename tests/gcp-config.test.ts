import { it, expect, beforeEach, afterEach, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_AUTH_PROVIDER', 'identity-platform');
  vi.stubEnv('BACKEND_URL', '');
  vi.stubEnv('REQUIRE_EXPLICIT_BACKEND_URL', '');
});
afterEach(() => vi.unstubAllEnvs());
it('refuses Google frontend builds without an explicit backend instead of using Render', async () => {
  vi.stubEnv('DEPLOYMENT_TARGET', '');
  await expect(import('../next.config')).rejects.toThrow('explicit BACKEND_URL');
});
it('builds standalone Cloud Run output and allows required Google OAuth scripts', async () => {
  vi.stubEnv('DEPLOYMENT_TARGET', 'cloud-run');
  const { default: config } = await import('../next.config');
  expect(config.output).toBe('standalone');
  const headers = await config.headers!();
  const csp = headers[0].headers.find((header) => header.key === 'Content-Security-Policy')!.value;
  expect(csp).toContain('https://apis.google.com');
  expect(csp).toContain('https://identitytoolkit.googleapis.com');
  expect(csp).not.toContain('supabase.co');
});
