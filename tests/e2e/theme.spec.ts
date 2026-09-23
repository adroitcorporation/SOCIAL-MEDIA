import { test, expect } from '@playwright/test';

const key = 'founder-circle-theme';
const themes = ['light', 'dark'] as const;

for (const theme of themes) {
  test(`follows the ${theme} system preference without saving an override`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
      'aria-pressed',
      String(theme === 'dark'),
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'dark' ? 'light' : 'dark',
    );
    expect(errors).toEqual([]);
  });
}

test('keyboard toggle persists a manual override across reloads and system changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
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
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(12, 21, 36)');
});

test('invalid or unavailable storage falls back to system and keeps the toggle usable', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, 'invalid'), key);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
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
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme preferences stay in sync across open tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
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
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', String(theme === 'dark'));
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(12, 21, 36)' : 'rgb(245, 247, 251)',
      );
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(toggle).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    expect(errors).toEqual([]);
  });
}

test('login screen exposes the same theme control on small screens', async ({ page }) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { demo: false, configured: false } }),
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/login');
  const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
  await expect(toggle).toBeInViewport();
  await expect(page.locator('.auth-card')).toHaveCSS('background-color', 'rgb(20, 34, 56)');
  await toggle.click();
  await expect(page.locator('.auth-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
