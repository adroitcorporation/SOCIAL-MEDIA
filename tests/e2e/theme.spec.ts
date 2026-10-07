import { test, expect } from '@playwright/test';
import { mockMobileApp } from './support/mobile-fixture';

const key = 'founder-circle-theme';
const themes = ['light', 'dark'] as const;

for (const theme of themes) {
  test(`defaults to Light with ${theme} OS preference without storing an override`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(errors).toEqual([]);
  });
}

test('keyboard toggle persists a manual override across reloads and system changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/profile');
  const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS('outline-style', 'solid');
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('dark');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'dark' });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('saved preference applies before React hydrates', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, 'dark'), key);
  await page.route('**/_next/static/**/*.js*', (route) => route.abort());
  await page.goto('/profile');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(28, 32, 33)');
});

test('invalid or unavailable storage falls back to Light and keeps the toggle usable', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, 'invalid'), key);
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage unavailable');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme preferences stay in sync across open tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/profile');
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: 'light' });
  await second.goto('/profile');
  await expect(second.getByRole('button', { name: 'Dark mode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key);
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'light');
  await second.close();
});

for (const theme of themes) {
  test(`${theme} theme covers every main screen and fits mobile`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), { key, theme });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of [
      '/',
      '/discover',
      '/connections',
      '/ideas',
      '/events',
      '/messages',
      '/notifications',
      '/profile',
      '/moderation',
      '/moderation/roles',
    ]) {
      await page.goto(route);
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
      if (route === '/profile') {
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-pressed', String(theme === 'dark'));
      } else {
        await expect(toggle).toHaveCount(0);
      }
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(28, 32, 33)' : 'rgb(241, 240, 235)',
      );
      await page.setViewportSize({ width: 375, height: 812 });
      if (route === '/profile') await expect(toggle).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    expect(errors).toEqual([]);
  });
}

test('login defaults to Light on dark OS without a duplicate control', async ({ page }) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { demo: false, configured: false } }),
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveCount(0);
  await expect(page.locator('.auth-card')).toHaveCSS('background-color', 'rgb(248, 247, 243)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const preference of [null, 'light', 'dark'] as const) {
  test(`startup resolves ${preference ?? 'no preference'} before hydration on a dark OS`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    if (preference)
      await page.addInitScript(({ key, preference }) => localStorage.setItem(key, preference), {
        key,
        preference,
      });
    await page.route('**/_next/static/**/*.js*', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', preference ?? 'light');
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      preference === 'dark' ? 'rgb(28, 32, 33)' : 'rgb(241, 240, 235)',
    );
  });
}

test('new account first login is Light; explicit Dark survives actual logout/login and Light survives refresh', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const { state } = await mockMobileApp(page);
  state.me.onboarded = false;
  state.me.collegeVerificationSource = 'APPROVED_EMAIL_DOMAIN';
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { configured: true, demo: false } }),
  );
  await page.route('**/session', (route) => route.fulfill({ status: 204 }));
  const user = {
    id: 'me',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'new-student@lnmiit.ac.in',
    email_confirmed_at: '2026-10-08',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-10-08T00:00:00Z',
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'me', aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`;
  let signIns = 0,
    signOuts = 0;
  await page.route('**/auth/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/logout')) {
      signOuts++;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/user')) return route.fulfill({ json: user });
    if (path.endsWith('/token')) {
      signIns++;
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: 'synthetic-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        },
      });
    }
    return route.abort();
  });
  const login = async () => {
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password-123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('.topbar')).toBeVisible();
  };
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await login();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.topbar-profile').click();
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.topbar .theme-toggle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('dark');
  await login();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.topbar-profile').click();
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('light');
  expect(signIns).toBe(2);
  expect(signOuts).toBe(1);
});
