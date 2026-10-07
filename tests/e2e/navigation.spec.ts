import { test, expect } from '@playwright/test';

const labels = ['Home', 'Idea Board', 'Discover', 'Events', 'Connections', 'Messages'];
const routes = ['/', '/ideas', '/discover', '/events', '/connections', '/messages'];

for (const isModerator of [false, true]) {
  test(`moderation navigation visibility follows isModerator=${isModerator}`, async ({ page }) => {
    await page.route('**/api/state*', async (route) => {
      const response = await route.fetch();
      const state = await response.json();
      await route.fulfill({ json: { ...state, isModerator } });
    });
    await page.goto('/');
    await expect(page.locator('.sidebar nav a')).toHaveText(
      isModerator ? [...labels, 'Moderation'] : labels,
    );
    await expect(page.locator('.sidebar a[href="/moderation"]')).toHaveCount(isModerator ? 1 : 0);
  });
}

for (const width of [1440, 768, 375, 320]) {
  test(`community navigation and profile-only theme at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    const links = sidebar.locator('nav a');
    const state = await (await request.get('/api/state')).json();
    await expect(links).toHaveText(state.isModerator ? [...labels, 'Moderation'] : labels);
    await expect(sidebar.locator('a[href="/notifications"]')).toHaveCount(0);
    await expect(page.locator('.topbar .theme-toggle')).toHaveCount(0);
    await expect(page.locator('.topbar a[href="/notifications"]')).toBeVisible();
    await expect(page.locator('.topbar a[href="/messages"]')).toBeVisible();
    const mobile = await page.getByRole('button', { name: 'Open navigation' }).isVisible();
    if (mobile) {
      await expect(page.locator('.bottom-nav a')).toHaveText(labels.slice(0, 5));
    }
    for (let index = 0; index < routes.length; index++) {
      if (mobile) await page.getByRole('button', { name: 'Open navigation' }).click();
      await links.nth(index).click();
      await expect(page).toHaveURL(
        new RegExp(`${routes[index] === '/' ? '/$' : routes[index] + '$'}`),
      );
      await expect(links.nth(index)).toHaveClass(/active/);
      await expect(page.locator('.page-content .loading')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.locator('.topbar a[href="/notifications"]').click();
    await expect(page.locator('.breadcrumb strong')).toHaveText('Notifications');
    await page.locator('.topbar-profile').click();
    await expect(page.locator('.page-content .theme-toggle')).toBeVisible();
    await expect(page.locator('.breadcrumb strong')).toHaveText('Profile');
    const previous = await page.locator('html').getAttribute('data-theme');
    await page.locator('.page-content .theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      previous === 'dark' ? 'light' : 'dark',
    );
  });
}
