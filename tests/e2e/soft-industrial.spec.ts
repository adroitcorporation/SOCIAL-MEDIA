import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mockMobileApp } from './support/mobile-fixture';

const widths = [1440, 1280, 1024, 768, 430, 390, 360];
const routes = ['/', '/ideas', '/discover', '/events', '/connections', '/messages', '/profile'];

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} authorized moderation uses real data across responsive widths`, async ({
    page,
    request,
  }) => {
    expect((await (await request.get('/api/config')).json()).demo).toBe(true);
    const db = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
        },
      },
    });
    const original = await db.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } });
    try {
      await db.user.update({ where: { id: original.id }, data: { role: 'MODERATOR' } });
      await page.emulateMedia({ colorScheme: theme });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/moderation');
        await expect(page.getByRole('heading', { name: 'Moderation dashboard' })).toBeVisible();
        await expect(page.locator('.metric-card')).toHaveCount(10);
        await expect(page.locator('.sidebar a[href="/moderation"]')).toHaveClass(/active/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (width === 1440 || width === 390)
          await page.screenshot({
            path: `.local/design-review/${theme}-${width}-moderation.png`,
            fullPage: true,
          });
      }
    } finally {
      await db.user.update({ where: { id: original.id }, data: { role: original.role } });
      await db.$disconnect();
    }
  });
  for (const width of widths) {
    test(`${theme} surfaces, fonts and responsive screens at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const { state } = await mockMobileApp(page);
      state.isModerator = true;
      state.me.role = 'MODERATOR';
      for (const path of routes) {
        await page.goto(path);
        await expect(page.locator('.topbar')).toBeVisible();
        await expect(page.locator('.loading')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('body')).toHaveCSS(
          'background-color',
          theme === 'dark' ? 'rgb(28, 32, 33)' : 'rgb(241, 240, 235)',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await expect(page.locator('.topbar .theme-toggle')).toHaveCount(0);
        await expect(page.locator('.sidebar a[href="/notifications"]')).toHaveCount(0);
        await expect(page.locator('.topbar a[href="/notifications"]')).toBeVisible();
        const fonts = await page.evaluate(() => {
          const heading = document.querySelector('h1')!;
          const titleFamily = getComputedStyle(heading).fontFamily;
          const bodyFamily = getComputedStyle(document.body).fontFamily;
          return {
            titleFamily,
            bodyFamily,
            headingLoaded: document.fonts.check(
              `600 28px ${titleFamily.split(',')[0]}`,
              'Founder Circle',
            ),
            bodyLoaded: document.fonts.check(
              `400 15px ${bodyFamily.split(',')[0]}`,
              'Founder Circle',
            ),
          };
        });
        expect(fonts.titleFamily).toMatch(/sora/i);
        expect(fonts.bodyFamily).toMatch(/inter/i);
        expect(fonts.headingLoaded && fonts.bodyLoaded).toBe(true);
        if (width === 1440 || width === 390) {
          await page.screenshot({
            path: `.local/design-review/${theme}-${width}-${path.slice(1) || 'home'}.png`,
            fullPage: true,
          });
        }
      }
      await page.locator('.topbar-profile').click();
      await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        theme === 'dark' ? 'light' : 'dark',
      );
      expect(errors).toEqual([]);
    });
  }
}
