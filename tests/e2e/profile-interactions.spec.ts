import { test, expect, type Page } from '@playwright/test';
import { mockMobileApp, fixtureStudent } from './support/mobile-fixture';
const active = (page: Page) => page.locator('.discover-profile-card:not(.is-preview)');
async function gesture(
  page: Page,
  points: number[][],
  interval = 16,
  pause = 0,
  bottom = false,
  cancel = false,
) {
  const card = active(page);
  const box = (await card.boundingBox())!;
  const nav = (await page.locator('.bottom-nav').boundingBox())!;
  const x = box.x + box.width * 0.65;
  const y = bottom ? Math.min(box.y + box.height - 85, nav.y - 30) : box.y + 55;
  const session = await page.context().newCDPSession(page);
  const beforeScroll = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  let previous = [0, 0];
  for (const point of points) {
    const steps = interval === 0 ? 2 : 6;
    for (let step = 1; step <= steps; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: x + previous[0] + ((point[0] - previous[0]) * step) / steps,
            y: y + previous[1] + ((point[1] - previous[1]) * step) / steps,
          },
        ],
      });
      if (interval) await page.waitForTimeout(interval);
    }
    previous = point;
  }
  const moved = await card.evaluate(
    (node) => Number.parseFloat((node as HTMLElement).style.getPropertyValue('--drag-x')) || 0,
  );
  const afterScroll = await page.evaluate(() => scrollY);
  if (pause) await page.waitForTimeout(pause);
  await session.send('Input.dispatchTouchEvent', {
    type: cancel ? 'touchCancel' : 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
  return { moved, beforeScroll, afterScroll };
}
for (const width of [1440, 1280, 1024, 768]) {
  test(`Home carousel controls and native scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { state, actions } = await mockMobileApp(page);
    state.students = Array.from({ length: 6 }, (_, i) => fixtureStudent(String(i)));
    state.connections = [];
    await page.goto('/');
    const tray = page.getByRole('region', { name: 'People to meet', exact: true });
    const previous = page.getByRole('button', { name: 'Previous profiles' });
    const next = page.getByRole('button', { name: 'Next profiles' });
    await expect(next).toBeEnabled();
    await expect(previous).toBeDisabled();
    const step = await tray.evaluate(
      (node) =>
        (node.children[1] as HTMLElement).offsetLeft - (node.children[0] as HTMLElement).offsetLeft,
    );
    await next.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeGreaterThan(step - 4);
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeLessThan(3);
    await tray.hover();
    await page.mouse.wheel(350, 0);
    await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeGreaterThan(100);
    // Wait for native wheel momentum and snap settling before the programmatic end jump.
    await expect
      .poll(async () => {
        const position = await tray.evaluate((node) => node.scrollLeft);
        await page.waitForTimeout(150);
        return position === (await tray.evaluate((node) => node.scrollLeft));
      })
      .toBe(true);

    await tray.evaluate((node) => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }));
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
    await tray.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }));
    const first = tray.locator('.student-card').first();
    await first.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(first).toContainText('Request Sent');
    await tray
      .locator('.student-card')
      .nth(1)
      .getByRole('button', { name: 'Skip Student 1' })
      .click();
    await expect(tray.locator('.student-card')).toHaveCount(5);
    expect(actions).toContain('skip:1');
    await page.locator('.profile-carousel-controls a').click();
    await expect(page).toHaveURL(/\/discover$/);
  });
}
test.describe('touch direction ownership', () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const width of [430, 390, 375, 360]) {
    for (const [name, points, complete, vertical, interval, pause, bottom, cancel] of [
      ['slow', [[-120, 0]], true, false, 20, 0, false, false],
      ['flick', [[-65, 0]], true, false, 0, 0, false, false],
      [
        'horizontal then vertical drift',
        [
          [-20, 0],
          [-120, 140],
        ],
        true,
        false,
        16,
        0,
        false,
        false,
      ],
      ['vertical', [[0, -140]], false, true, 16, 0, false, false],
      ['horizontal diagonal', [[-120, -55]], true, false, 16, 0, false, false],
      ['vertical diagonal', [[-40, -140]], false, true, 16, 0, false, false],
      ['short cancelled', [[-30, 0]], false, false, 16, 150, false, false],
      ['near bottom', [[-120, 18]], true, false, 16, 0, true, false],
      ['pointer cancelled', [[-55, 0]], false, false, 16, 0, false, true],
    ] as const) {
      test(`${name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const { state, actions, calls } = await mockMobileApp(page);
        state.connections = [];
        await page.goto('/discover');
        await expect(active(page).locator('.student-name')).toHaveText('Student A');
        const initial = calls.filter((call) => call === 'GET /api/state').length;
        const result = await gesture(
          page,
          points.map((point) => [...point]),
          interval,
          pause,
          bottom,
          cancel,
        );
        if (vertical) {
          expect(result.moved).toBe(0);
          expect(result.afterScroll).toBeGreaterThan(result.beforeScroll + 10);
        } else expect(result.afterScroll).toBe(result.beforeScroll);
        if (complete) {
          await expect(active(page).locator('.student-name')).toHaveText('Student B');
          expect(actions).toEqual(['skip:A']);
        } else {
          await expect(active(page).locator('.student-name')).toHaveText('Student A');
          await expect(active(page)).not.toHaveClass(/is-dragging|is-exiting/);
          expect(actions).toEqual([]);
        }
        expect(calls.filter((call) => call === 'GET /api/state')).toHaveLength(initial);
      });
    }
    test(`Connect and Skip taps at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const { state, actions } = await mockMobileApp(page);
      state.connections = [];
      await page.goto('/discover');
      await active(page).getByRole('button', { name: 'Connect', exact: true }).tap();
      await expect(active(page)).toContainText('Pending');
      await active(page).getByRole('button', { name: 'Skip Student A' }).tap();
      await expect(active(page).locator('.student-name')).toHaveText('Student B');
      expect(actions).toEqual(['connect:A', 'skip:A']);
    });
  }
});

test('carousel controls stay hidden when all profiles fit', async ({ page }) => {
  const { state } = await mockMobileApp(page);
  state.students = [fixtureStudent('only')];
  await page.goto('/');
  await expect(page.locator('.horizontal-profile-tray .student-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Next profiles' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous profiles' })).toHaveCount(0);
});
test.describe('gesture edge cases', () => {
  test.use({ isMobile: true, hasTouch: true });
  test('drag beginning on Connect suppresses its click and survives viewport-height changes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state, actions } = await mockMobileApp(page);
    state.connections = [];
    await page.goto('/discover');
    const connect = active(page).getByRole('button', { name: 'Connect', exact: true });
    await connect.scrollIntoViewIfNeeded();
    const box = (await connect.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - 20, y }],
    });
    await expect(active(page)).toHaveClass(/is-dragging/);
    await page.setViewportSize({ width: 390, height: 740 });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - 35, y: y + 8 }],
    });
    await expect
      .poll(() =>
        active(page).evaluate((node) =>
          Number.parseFloat((node as HTMLElement).style.getPropertyValue('--drag-x')),
        ),
      )
      .toBe(-35);
    expect(actions).toEqual([]);
    await page.waitForTimeout(150);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(active(page)).not.toHaveClass(/is-dragging|is-exiting/);
    expect(actions).toEqual([]);
    await expect(connect).toBeEnabled();
    await session.detach();
  });
});
