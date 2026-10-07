import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mockMobileApp, emitActivity, navigateMobile, touchDrag } from './support/mobile-fixture';

test.describe('mobile layout and gestures', () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [375, 667],
    [390, 844],
    [393, 873],
    [412, 915],
    [430, 932],
  ]) {
    test(`primary screens remain reachable at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mockMobileApp(page, true);
      for (const path of [
        '/',
        '/discover',
        '/profile',
        '/u/student--A',
        '/ideas',
        '/events',
        '/connections',
        '/notifications',
        '/messages',
      ]) {
        await page.goto(path);
        await expect(page.locator('.page-content')).toBeVisible();
        await expect(page.locator('.loading')).toHaveCount(0);
        if (path.startsWith('/u/'))
          await page.getByRole('button', { name: 'About', exact: true }).click();
        if (path === '/discover')
          await page.getByRole('button', { name: 'Filters', exact: true }).click();
        if (path === '/messages') {
          await page.locator('.conversation-row').click();
          await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Delete chat', exact: true }).click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          const box = (await dialog.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(box.height).toBeLessThanOrEqual(height);
          await dialog.getByRole('button', { name: 'Keep chat' }).click();
        }
        const overflow = await page.evaluate(() => {
          const main = document.querySelector('main')!,
            bounds = main.getBoundingClientRect();
          return [...main.querySelectorAll<HTMLElement>('*')]
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                !node.closest(
                  '.horizontal-profile-tray,.tabs,.category-chips,[aria-hidden="true"]',
                ) &&
                (rect.right > bounds.right + 3 || rect.left < bounds.left - 3)
              );
            })
            .map((node) => `${node.tagName}.${node.className}`)
            .slice(0, 10);
        });
        expect(overflow, `${path} has clipped/overflowing children`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const clearance = await page.evaluate(() => {
          const main = document.querySelector('main')!,
            nav = document.querySelector('.bottom-nav')!;
          const content = main.querySelector('.screen-transition')!;
          return {
            contentBottom: content.getBoundingClientRect().bottom,
            navTop: nav.getBoundingClientRect().top,
          };
        });
        expect(
          clearance.contentBottom,
          `${path} content is covered by navigation`,
        ).toBeLessThanOrEqual(clearance.navTop + 1);
        if (path === '/profile' || path.startsWith('/u/')) {
          for (const heading of ['Skills', 'Interests', 'Domains', 'Looking for'])
            await expect(page.getByRole('heading', { name: heading, exact: true })).toBeAttached();
          await expect(page.locator('.profile-details')).toContainText(
            'College affiliation has been verified.',
          );
        }
        if (path.startsWith('/u/'))
          await expect(page.getByRole('button', { name: 'Block student' })).toBeVisible();
      }
      await page.getByRole('button', { name: /^More/ }).click();
      const menu = page.locator('.mobile-more-sheet');
      await menu.getByRole('button', { name: 'Log out' }).scrollIntoViewIfNeeded();
      await expect(menu.getByRole('button', { name: 'Log out' })).toBeVisible();
      expect(
        await menu.evaluate((node) => node.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(height + 1);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    });
  }

  test('Home supports native touch momentum, complete last-card visibility, vertical scroll and profile taps', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { actions } = await mockMobileApp(page);
    await page.goto('/');
    const tray = page.getByRole('region', { name: 'People to meet' });
    await tray.scrollIntoViewIfNeeded();
    const bounds = (await tray.boundingBox())!;
    await touchDrag(page, bounds.x + bounds.width - 40, bounds.y + 70, -220);
    await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeGreaterThan(100);
    expect(actions).toEqual([]);
    await expect(page).toHaveURL(/\/$/);
    expect(await tray.evaluate((node) => getComputedStyle(node).scrollbarWidth)).toBe('none');
    await tray.evaluate((node) => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }));
    await expect
      .poll(() =>
        tray.evaluate((node) =>
          Math.round(
            node.lastElementChild!.getBoundingClientRect().right -
              node.getBoundingClientRect().right,
          ),
        ),
      )
      .toBeLessThanOrEqual(1);
    const before = await page.evaluate(() => scrollY);
    const end = (await tray.boundingBox())!;
    await touchDrag(page, end.x + 80, end.y + 120, 0, -110);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await tray.locator('.student-name').last().click();
    await expect(page).toHaveURL(/--F$/);
  });

  test('Discover touch drag batches transforms, advances once without profile refetch, and recovers failures', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { actions, calls, controls, state } = await mockMobileApp(page);
    state.connections = [];
    await page.goto('/discover');
    const active = () => page.locator('.discover-profile-card:not(.is-preview)');
    await expect(active().locator('.student-name')).toHaveText('Student A');
    await expect(page.locator('.is-preview')).toHaveAttribute('inert', '');
    const dragBounds = (await active().boundingBox())!;
    await page.mouse.move(dragBounds.x + 80, dragBounds.y + 40);
    await page.mouse.down();
    const styleWrites = await active().evaluate(async (card) => {
      let writes = 0;
      const observer = new MutationObserver((records) => {
        writes += records.length;
      });
      observer.observe(card, { attributes: true, attributeFilter: ['style'] });
      for (let x = 101; x <= 200; x++)
        card.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            pointerId: 1,
            isPrimary: true,
            clientX: x,
            clientY: card.getBoundingClientRect().y + 40,
          }),
        );
      await new Promise(requestAnimationFrame);
      await Promise.resolve();
      observer.disconnect();
      card.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, isPrimary: true }),
      );
      return writes;
    });
    expect(styleWrites).toBeGreaterThan(0);
    expect(styleWrites).toBeLessThanOrEqual(2);
    await page.mouse.up();
    const initialRequests = calls.filter((entry) => entry === 'GET /api/state').length;
    const bounds = (await active().boundingBox())!;
    await touchDrag(page, bounds.x + 90, bounds.y + 55, 150);
    await expect(active().locator('.student-name')).toHaveText('Student B');
    expect(actions).toEqual(['connect:A']);
    expect(calls.filter((entry) => entry === 'GET /api/state')).toHaveLength(initialRequests);
    controls.fail = true;
    const second = (await active().boundingBox())!;
    await touchDrag(page, second.x + second.width - 65, second.y + 60, -160);
    await expect(page.getByText('Action failed', { exact: true })).toBeVisible();
    await expect(active().locator('.student-name')).toHaveText('Student B');
    await expect(active()).not.toHaveClass(/is-exiting/);
    controls.fail = false;
    await active().getByRole('button', { name: 'Skip Student B' }).click();
    await expect(active().locator('.student-name')).toHaveText('Student C');
    expect(actions).toEqual(['connect:A', 'skip:B', 'skip:B']);
  });

  test('one global subscription delivers deduplicated popups and authoritative badges on every main tab', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state } = await mockMobileApp(page);
    await page.goto('/');
    await expect(page.locator('.page-content')).toContainText('People to meet');
    await emitActivity(page, { items: [], unreadCount: 0 });
    for (const [index, path] of [
      '/',
      '/discover',
      '/profile',
      '/ideas',
      '/events',
      '/connections',
      '/messages',
      '/notifications',
    ].entries()) {
      if (new URL(page.url()).pathname !== path) await navigateMobile(page, path);
      const item = {
        id: `notification-${index}`,
        userId: 'me',
        title: `New request ${index}`,
        body: 'A student sent you a connection request',
        href: '/connections',
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      state.notifications.unshift(item);
      state.notificationUnread = 1;
      const payload = { items: state.notifications, unreadCount: 1 };
      await emitActivity(page, payload);
      await emitActivity(page, payload);
      await expect(page.locator('.notification-toast')).toHaveCount(1);
      await expect(page.getByRole('link', { name: '1 unread notifications' })).toBeVisible();
      await page.locator('.notification-toast-open').click();
      await expect(page).toHaveURL(/\/connections$/);
      await expect(page.locator('.notification-toast')).toHaveCount(0);
      await expect(page.getByRole('link', { name: '0 unread notifications' })).toBeVisible();
    }
    await page.getByRole('button', { name: /^More/ }).click();
    const item = {
      id: 'menu-activity',
      userId: 'me',
      title: 'Activity while in More',
      body: 'Group invitation',
      href: '/messages?conversation=group',
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    state.notifications.unshift(item);
    await emitActivity(page, { items: state.notifications, unreadCount: 1 });
    await expect(page.locator('.notification-toast')).toContainText(item.title);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: `Dismiss ${item.title}` }).click();
    await expect(page.locator('.notification-toast')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '1 unread notifications' })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __liveStarts: number }).__liveStarts),
    ).toBe(1);
  });
});

test('desktop layouts and horizontal trackpad navigation remain functional', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockMobileApp(page);
  await page.goto('/');
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  const tray = page.getByRole('region', { name: 'People to meet' });
  await tray.scrollIntoViewIfNeeded();
  await tray.hover();
  await page.mouse.wheel(400, 0);
  await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await page.locator('.sidebar a[href="/discover"]').click();
  await expect(
    page
      .locator('.discover-profile-card:not(.is-preview)')
      .getByRole('button', { name: 'Respond', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test('real database activity reaches an unrelated tab through SSE and is marked read by toast navigation', async ({
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
  const id = `sse-browser-${Date.now()}`;
  try {
    await page.goto('/events');
    await expect(page.locator('.page-content h1')).toHaveText('Events');
    await page.waitForTimeout(300);
    await db.notification.create({
      data: {
        id,
        userId: 'demo-aarav',
        title: 'Real SSE connection request',
        body: 'New server-backed activity',
        href: '/connections',
      },
    });
    await expect(page.locator('.notification-toast')).toContainText('Real SSE connection request');
    await page
      .locator('.notification-toast-open')
      .filter({ hasText: 'Real SSE connection request' })
      .click();
    await expect(page).toHaveURL(/\/connections$/);
    expect((await db.notification.findUniqueOrThrow({ where: { id } })).readAt).not.toBeNull();
  } finally {
    await db.notification.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
