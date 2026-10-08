import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it('fails frontend configuration when its required backend URL is missing', async () => {
  vi.stubEnv('REQUIRE_EXPLICIT_BACKEND_URL', 'true');
  vi.stubEnv('BACKEND_URL', '');
  await expect(import('../next.config')).rejects.toThrow('explicit isolated BACKEND_URL');
  vi.resetModules();
  vi.stubEnv('BACKEND_URL', 'https://staging.invalid');
  const { default: config } = await import('../next.config');
  const rewrites = await config.rewrites!();
  expect(JSON.stringify(rewrites)).toContain('https://staging.invalid/api/');
  expect(JSON.stringify(rewrites)).not.toContain('founder-circle-backend.onrender.com');
});
it('isolates staging service names, disables automatic deployment and scopes secrets to the backend', () => {
  const config = YAML.parse(readFileSync('deployment/render.singapore-staging.yaml', 'utf8'));
  expect(config.databases).toBeUndefined();
  expect(config.services).toHaveLength(2);
  for (const service of config.services) {
    expect(service.name).toMatch(/^founder-circle-singapore-staging-/);
    expect(service.autoDeployTrigger).toBe('off');
    expect(service.branch).toBe('audit/supabase-singapore-migration-2026-10-08');
    const env = Object.fromEntries(
      service.envVars.map((item: { key: string; value?: string }) => [item.key, item.value]),
    );
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://lxofcmzgzbgqvlmwizgm.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_EXPECTED_PROJECT_REF).toBe('lxofcmzgzbgqvlmwizgm');
    if (service.name.endsWith('frontend')) {
      expect(env).not.toHaveProperty('DATABASE_URL');
      expect(env).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
      expect(env.REQUIRE_EXPLICIT_BACKEND_URL).toBe('true');
      expect(service.startCommand).not.toBe('npm start');
    } else {
      expect(env.FILE_STORAGE_MODE).toBe('supabase');
      expect(env.SUPABASE_EXPECTED_PROJECT_REF).toBe('lxofcmzgzbgqvlmwizgm');
      expect(
        service.envVars.find((item: { key: string }) => item.key === 'SUPABASE_SERVICE_ROLE_KEY')
          .sync,
      ).toBe(false);
    }
  }
});
