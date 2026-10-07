import { test, expect } from '@playwright/test';
import { mockMobileApp } from './support/mobile-fixture';

test.use({ isMobile: true, hasTouch: true });
for (const [width, height] of [
  [430, 932],
  [390, 844],
  [375, 667],
  [360, 640],
  [740, 360],
]) {
  test(`four-item navigation and More sheet at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const { state } = await mockMobileApp(page);
    state.notificationUnread = 3;
    state.conversations[0].unread = 2;
    await page.goto('/ideas');
    const bar = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
    await expect(bar.locator('a')).toHaveText(['Home', 'Discover', 'Idea Board']);
    await expect(bar.locator('button')).toHaveCount(1);
    await expect(bar.locator('a.active')).toHaveText('Idea Board');
    await expect(bar.getByRole('button', { name: 'More, 5 unread' })).toBeVisible();
    expect(
      await bar.evaluate((node) =>
        [...node.querySelectorAll('a > span, button > span:last-child')].every(
          (label) => label.scrollWidth <= label.clientWidth,
        ),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const [label, href] of [
      ['Events', '/events'],
      ['Connections', '/connections'],
      ['Messages', '/messages'],
      ['Notifications', '/notifications'],
      ['Profile', '/profile'],
      ['Settings', '/profile#profile-settings'],
    ]) {
      await bar.getByRole('button', { name: /^More/ }).click();
      const sheet = page.getByRole('dialog', { name: 'More', exact: true });
      await expect(sheet.locator('nav a')).toHaveCount(6);
      await expect(sheet.locator('a[href="/messages"] .nav-count')).toHaveText('2');
      await expect(sheet.locator('a[href="/notifications"] .nav-count')).toHaveText('3');
      await expect(sheet.locator('a[href="/moderation"]')).toHaveCount(0);
      await sheet.getByRole('link', { name: new RegExp(`^${label}`) }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(href.replaceAll('/', '\\/') + '$'));
    }
    await expect(page.locator('#profile-settings .theme-toggle')).toBeVisible();
    await expect(page.locator('.topbar .theme-toggle')).toHaveCount(0);
    await bar.getByRole('button', { name: /^More/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'More', exact: true })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: /^More/ })).toBeFocused();
  });
}
test('authorized moderation appears in More, safe-area inset increases clearance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await mockMobileApp(page);
  state.isModerator = true;
  await page.goto('/ideas');
  const before = await page
    .locator('.bottom-nav')
    .evaluate((node) => node.getBoundingClientRect().height);
  // Headless Chromium reports zero device insets; exercise the actual CSS formulas with 24px.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
      .join('\n')
      .replaceAll('env(safe-area-inset-bottom)', '24px');
    document.head.append(style);
  });
  await expect
    .poll(() => page.locator('.bottom-nav').evaluate((node) => node.getBoundingClientRect().height))
    .toBe(before + 24);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const barTop = await page
    .locator('.bottom-nav')
    .evaluate((node) => node.getBoundingClientRect().top);
  const contentBottom = await page
    .locator('.idea-card')
    .last()
    .evaluate((node) => node.getBoundingClientRect().bottom);
  expect(contentBottom).toBeLessThanOrEqual(barTop);
  await page.getByRole('button', { name: /^More/ }).click();
  await expect(page.locator('.mobile-more-sheet a[href="/moderation"]')).toBeVisible();
});
