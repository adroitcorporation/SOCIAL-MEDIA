import { defineConfig } from '@playwright/test';
const origin = process.env.GCP_STAGING_FRONTEND_ORIGIN;
const project = process.env.GCP_STAGING_PROJECT_ID;
const authProject = process.env.GCP_STAGING_AUTH_PROJECT_ID;
if (
  process.env.APP_ENV !== 'staging' ||
  !origin ||
  !project ||
  !project.includes('-staging') ||
  !authProject?.includes('-staging')
)
  throw new Error('Explicit isolated GCP staging project/origin required.');
const url = new URL(origin);
if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
  throw new Error('Canonical staging HTTPS origin required.');
export default defineConfig({
  testDir: './tests/gcp-e2e',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
