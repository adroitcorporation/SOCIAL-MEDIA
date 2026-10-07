import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mockMobileApp } from './support/mobile-fixture';
import { connectionReadyProfile } from '../fixtures/connection-ready';

test('real Discover click persists one request; duplicate, cancel, incoming accept and reject', async ({
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
  const actor = await db.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } });
  const id = `connect-check-${Date.now()}`;
  const name = `Connection Check ${Date.now()}`;
  const pairKey = [actor.id, id].sort().join(':');
  try {
    await db.user.update({
      where: { id: actor.id },
      data: { ...connectionReadyProfile, name: actor.name, collegeVerified: true, onboarded: true },
    });
    await db.user.create({
      data: { ...connectionReadyProfile, id, name, collegeVerified: true, onboarded: true },
    });
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/connections')
        posts.push(r.postData()!);
    });
    await page.goto(`/discover?search=${encodeURIComponent(name)}`);
    const active = page.locator('.student-card:not(.is-preview)');
    await expect(active.locator('.student-name')).toHaveText(name);
    const response = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/connections' && r.request().method() === 'POST',
    );
    await active.getByRole('button', { name: 'Connect', exact: true }).click();
    expect((await response).ok()).toBe(true);
    await expect(active.getByRole('button', { name: 'Pending', exact: true })).toBeDisabled();
    expect(posts.map((p) => JSON.parse(p))).toEqual([{ userId: id }]);
    const saved = await db.connection.findUniqueOrThrow({ where: { pairKey } });
    expect(saved).toMatchObject({ requesterId: actor.id, receiverId: id, status: 'PENDING' });
    expect(await db.connection.count({ where: { pairKey } })).toBe(1);
    const duplicate = await request.post('/api/connections', { data: { userId: id } });
    expect(duplicate.status()).toBe(409);
    await page.reload();
    // Existing discovery service excludes active relationships after a fresh fetch.
    await expect(active.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
    await page.goto('/connections');
    await page.getByRole('button', { name: /Sent Requests/ }).click();
    await page
      .locator('.connection-card')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Cancel Request' })
      .click();
    await expect
      .poll(async () => (await db.connection.findUniqueOrThrow({ where: { pairKey } })).status)
      .toBe('CANCELLED');
    // Seed an incoming request so the real demo account can exercise receiver authorization.
    await db.connection.update({
      where: { pairKey },
      data: { requesterId: id, receiverId: actor.id, status: 'PENDING' },
    });
    await page.goto('/connections');
    await page.getByRole('button', { name: /Incoming Requests/ }).click();
    const incoming = page.locator('.connection-card').filter({ hasText: name });
    await incoming.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect
      .poll(async () => (await db.connection.findUniqueOrThrow({ where: { pairKey } })).status)
      .toBe('ACCEPTED');
    await page.getByRole('button', { name: /^Connections/ }).click();
    await expect(page.locator('.connection-card').filter({ hasText: name })).toBeVisible();
    await page.goto(`/discover?search=${encodeURIComponent(name)}`);
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
    await db.connection.update({ where: { pairKey }, data: { status: 'PENDING' } });
    await page.goto('/connections');
    await page.getByRole('button', { name: /Incoming Requests/ }).click();
    await incoming.getByRole('button', { name: /Decline|Reject/ }).click();
    await expect
      .poll(async () => (await db.connection.findUniqueOrThrow({ where: { pairKey } })).status)
      .toBe('REJECTED');
    await db.user.update({ where: { id: actor.id }, data: { bio: '' } });
    const incomplete = await request.post('/api/connections', { data: { userId: id } });
    expect(incomplete.status()).toBe(403);
    expect((await incomplete.json()).code).toBe('PROFILE_INCOMPLETE');
    await db.block.create({ data: { blockerId: actor.id, blockedId: id } });
    expect((await request.post('/api/connections', { data: { userId: id } })).status()).toBe(403);
  } finally {
    await db.notification.deleteMany({ where: { userId: actor.id, body: { contains: name } } });
    await db.user.deleteMany({ where: { id } });
    const {
      name: originalName,
      bio,
      college,
      graduationYear,
      skills,
      interests,
      domains,
      lookingFor,
      collegeVerified,
      onboarded,
    } = actor;
    await db.user.update({
      where: { id: actor.id },
      data: {
        name: originalName,
        bio,
        college,
        graduationYear,
        skills,
        interests,
        domains,
        lookingFor,
        collegeVerified,
        onboarded,
      },
    });
    await db.$disconnect();
  }
});

test('Connecting disables repeat clicks; errors restore Connect; pending remains across cached views', async ({
  page,
}) => {
  const { state } = await mockMobileApp(page);
  state.connections = [];
  let posts = 0,
    fail = true;
  let release: (() => void) | undefined;
  await page.route('**/api/connections', async (route) => {
    posts++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    if (fail) return route.fulfill({ status: 500, json: { error: 'Server failure' } });
    const connection = {
      id: 'new',
      pairKey: 'A:me',
      requesterId: 'me',
      receiverId: 'A',
      status: 'PENDING' as const,
      requester: state.me,
      receiver: state.students[0],
      createdAt: state.me.createdAt,
      updatedAt: state.me.updatedAt,
    };
    state.connections.push(connection);
    return route.fulfill({ json: connection });
  });
  await page.goto('/'); // Populate Home cache first.
  await page.locator('.sidebar a[href="/discover"]').click();
  await expect(page).toHaveURL(/discover/);
  const active = page.locator('.discover-profile-card:not(.is-preview)');
  await active.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(active.getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  await active
    .getByRole('button', { name: 'Connecting...' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  expect(posts).toBe(1);
  release!();
  await expect(page.getByText("Couldn't send connection request. Please try again.")).toBeVisible();
  await expect(active.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled();
  fail = false;
  await active.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(active.getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  release!();
  await expect(active.getByRole('button', { name: 'Pending', exact: true })).toBeDisabled();
  expect(posts).toBe(2);
  await page.locator('.sidebar .nav-link[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator('.student-card').filter({ hasText: 'Student A' }).getByText('Request Sent'),
  ).toBeVisible();
});

for (const status of ['ACCEPTED', 'PENDING', 'BLOCKED', 'INCOMPLETE'] as const) {
  test(`Discover safely represents ${status}`, async ({ page }) => {
    const { state, actions } = await mockMobileApp(page);
    if (status === 'ACCEPTED') state.connections[0].status = 'ACCEPTED';
    if (status === 'BLOCKED') state.blockedIds = ['A'];
    if (status === 'INCOMPLETE') {
      state.connections = [];
      state.me.bio = '';
    }
    await page.goto('/discover');
    const active = page.locator('.student-card:not(.is-preview)');
    if (status === 'ACCEPTED')
      await expect(active.getByRole('button', { name: 'Connected', exact: true })).toBeDisabled();
    if (status === 'PENDING') {
      await active.getByRole('button', { name: 'Respond' }).click();
      await expect(page).toHaveURL(/connections/);
    }
    if (status === 'BLOCKED')
      await expect(active.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
    if (status === 'INCOMPLETE') {
      await active.getByRole('button', { name: 'Connect', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    expect(actions).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const)
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    test(`${theme} refined chips and long Discover content fit ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      const { state } = await mockMobileApp(page, true);
      state.connections = [];
      await page.goto('/discover');
      const active = page.locator('.student-card:not(.is-preview)');
      await expect(active.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const chips = await active.locator('.tag').evaluateAll((elements) =>
        elements.map((e) => ({
          rect: e.getBoundingClientRect().toJSON(),
          style: getComputedStyle(e).color,
          background: getComputedStyle(e).backgroundColor,
        })),
      );
      expect(chips.length).toBeGreaterThan(2);
      for (const chip of chips) {
        expect(chip.rect.right).toBeLessThanOrEqual(width);
        expect(chip.style).not.toBe(chip.background);
      }
      const connect = (await active
        .getByRole('button', { name: 'Connect', exact: true })
        .boundingBox())!;
      const skip = (await active.getByRole('button', { name: /^Skip/ }).boundingBox())!;
      expect(connect.height).toBeGreaterThanOrEqual(40);
      const cover = (await active.locator('.discover-cover').boundingBox())!;
      const name = (await active.locator('.student-name').boundingBox())!;
      expect(name.y).toBeGreaterThanOrEqual(cover.y);
      expect(name.y + name.height).toBeLessThanOrEqual(cover.y + cover.height);
      expect(
        await active.locator('.discover-cover').evaluate((e) => e.scrollHeight <= e.clientHeight),
      ).toBe(true);
      expect(skip.x + skip.width).toBeLessThanOrEqual(connect.x);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `.local/design-review/refined-${theme}-${width}-discover.png`,
          fullPage: true,
        });
      await page.goto('/profile');
      for (const category of ['skill', 'interest', 'domain', 'looking'])
        await expect(page.locator(`.profile-details .tag-${category}`).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `.local/design-review/refined-${theme}-${width}-profile.png`,
          fullPage: true,
        });
    });
  }
