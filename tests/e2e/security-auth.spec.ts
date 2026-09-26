import { test, expect } from '@playwright/test';

// The application target must be the isolated local demo. For these UI checks
// only, its config response is intercepted to display the real auth form.
test.beforeEach(async ({ page, request, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe('localhost');
  expect((await (await request.get('/api/config')).json()).demo).toBe(true);
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { demo: false, configured: true } }),
  );
});

test('login and signup visibly reject non-LNMIIT email without calling the provider', async ({
  page,
}) => {
  let providerCalls = 0;
  await page.route('**/auth/v1/**', (route) => {
    providerCalls++;
    return route.abort();
  });
  for (const path of ['/login', '/signup']) {
    await page.goto(path);
    await page.getByLabel('Email address').fill('synthetic@example.com');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password-123');
    await page
      .getByRole('button', {
        name: path === '/login' ? 'Sign in' : 'Create your account',
        exact: true,
      })
      .click();
    await expect(page.locator('.auth-card').getByRole('alert')).toContainText(
      'Use your @lnmiit.ac.in college email',
    );
  }
  expect(providerCalls).toBe(0);
});

test('shows an email-not-confirmed provider error', async ({ page }) => {
  let providerCalls = 0;
  await page.route('**/auth/v1/token**', (route) => {
    providerCalls++;
    return route.fulfill({
      status: 400,
      json: { code: 'email_not_confirmed', msg: 'Email not confirmed' },
    });
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('synthetic@lnmiit.ac.in');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toContainText('Email not confirmed');
  expect(providerCalls).toBe(1);
});
