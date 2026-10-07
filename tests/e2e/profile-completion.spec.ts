import { expect, test } from '@playwright/test';
import { test as verifiedTest } from './verified-demo';
import { mockMobileApp, navigateMobile, touchDrag } from './support/mobile-fixture';
import { PrismaClient } from '@prisma/client';
import { connectionReadyProfile } from '../fixtures/connection-ready';

for (const width of [320, 390, 1440]) {
  test(`Home, Discover and profile Connect explain missing fields at ${width}px`, async ({
    page,
  }) => {
    const height = width === 320 ? 568 : 844;
    await page.setViewportSize({ width, height });
    const { state, actions } = await mockMobileApp(page);
    state.connections = [];
    state.me.bio = '';
    state.me.skills = [];
    state.me.lookingFor = [];
    for (const path of ['/', '/discover', '/u/student--A']) {
      await page.goto(path);
      const connect =
        path === '/'
          ? page
              .locator('.horizontal-profile-tray .student-card')
              .first()
              .getByRole('button', { name: 'Connect', exact: true })
          : path === '/discover'
            ? page
                .locator('.discover-profile-card:not(.is-preview)')
                .getByRole('button', { name: 'Connect', exact: true })
            : page.getByRole('button', { name: 'Connect', exact: true });
      await connect.click();
      const dialog = page.getByRole('dialog', { name: 'Complete your profile to connect' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('li').filter({ hasText: 'Bio' })).toContainText('Missing');
      await expect(dialog.locator('li').filter({ hasText: 'skill' })).toContainText('Missing');
      await expect(dialog.locator('li').filter({ hasText: 'Looking for' })).toContainText(
        'Missing',
      );
      await expect(dialog.locator('li').filter({ hasText: 'Name' })).toContainText('Complete');
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeLessThanOrEqual(height);
      await expect(
        dialog.getByRole('button', { name: 'Complete Profile', exact: true }),
      ).toBeInViewport({ ratio: 1 });
      if (width === 320 && path === '/')
        await page.screenshot({ path: 'test-results/profile-completion-320.png' });
      await dialog.getByRole('button', { name: 'Complete Profile', exact: true }).click();
      await expect(page).toHaveURL(/\/profile\?edit=1$/);
      await expect(page.getByLabel('Bio (required)', { exact: true })).toBeVisible();
    }
    expect(actions).toEqual([]);
  });
}

test('saving missing details unlocks Connect on previously visited tabs without reloading', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state, actions } = await mockMobileApp(page);
  state.connections = [];
  Object.assign(state.me, {
    bio: '',
    skills: ['React'],
    interests: ['Technology'],
    domains: ['Education'],
    lookingFor: ['Project partners'],
  });
  await page.route('**/api/profile', async (route) => {
    state.me = { ...state.me, ...route.request().postDataJSON() };
    await route.fulfill({ json: state.me });
  });
  await page.goto('/');
  await navigateMobile(page, '/discover');
  await navigateMobile(page, '/profile');
  await expect(page.getByLabel('Profile completion')).toContainText('86%');
  await page.getByRole('button', { name: 'Complete Profile', exact: true }).click();
  await page
    .getByLabel('Bio (required)', { exact: true })
    .fill('I love building useful student projects with collaborators.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Profile completion')).toHaveCount(0);
  await navigateMobile(page, '/discover');
  await page
    .locator('.discover-profile-card:not(.is-preview)')
    .getByRole('button', { name: 'Connect', exact: true })
    .click();
  await expect.poll(() => actions).toEqual(['connect:A']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a stale complete client handles PROFILE_INCOMPLETE from the server with its missing fields', async ({
  page,
}) => {
  const { state } = await mockMobileApp(page);
  state.connections = [];
  await page.route('**/api/connections', (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: 'Complete your profile before sending connection requests.',
        code: 'PROFILE_INCOMPLETE',
        missingFields: ['bio'],
      },
    }),
  );
  await page.goto('/discover');
  const card = page.locator('.discover-profile-card:not(.is-preview)');
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('li').filter({ hasText: 'Bio' })).toContainText('Missing');
  await expect(dialog.locator('li').filter({ hasText: 'skill' })).toContainText('Complete');
  await expect(card).not.toHaveClass(/is-exiting/);
  await expect(card.locator('.student-name')).toHaveText('Student A');
});

test.describe('incomplete browsing and touch', () => {
  test.use({ isMobile: true, hasTouch: true });
  test('an incomplete new account can explore and a right swipe opens the completion prompt', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state, actions } = await mockMobileApp(page);
    state.connections = [];
    state.me.onboarded = false;
    state.me.bio = '';
    for (const path of ['/', '/events', '/ideas', '/u/student--A', '/discover']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    const card = page.locator('.discover-profile-card:not(.is-preview)');
    const box = (await card.boundingBox())!;
    await touchDrag(page, box.x + 70, box.y + 50, 160);
    await expect(
      page.getByRole('dialog', { name: 'Complete your profile to connect' }),
    ).toBeVisible();
    await expect(card).not.toHaveClass(/is-exiting|is-dragging/);
    expect(actions).toEqual([]);
  });
});

verifiedTest(
  'real API rejects an incomplete account, then the profile editor unlocks a persisted connection',
  async ({ page, request }) => {
    expect((await (await request.get('/api/config')).json()).demo).toBe(true);
    const db = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
        },
      },
    });
    const targetId = `completion-${Date.now()}`;
    const me = await db.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } });
    const {
      name,
      photo,
      college,
      degree,
      graduationYear,
      city,
      bio,
      skills,
      interests,
      domains,
      lookingFor,
      linkedin,
      github,
      instagram,
      portfolio,
      onboarded,
    } = me;
    try {
      await db.user.create({ data: { id: targetId, ...connectionReadyProfile, onboarded: true } });
      await db.user.update({ where: { id: me.id }, data: { bio: '' } });
      const blocked = await request.post('/api/connections', {
        data: { userId: targetId, isComplete: true },
      });
      expect(blocked.status()).toBe(403);
      expect(await blocked.json()).toMatchObject({
        code: 'PROFILE_INCOMPLETE',
        missingFields: ['bio'],
      });
      await page.goto(`/u/test--${targetId}`);
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Complete Profile' }).click();
      await page
        .getByLabel('Bio (required)', { exact: true })
        .fill('I enjoy building useful projects with other students.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
      await page.goBack();
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Request pending', exact: true }),
      ).toBeVisible();
      expect(
        await db.connection.findFirst({ where: { requesterId: me.id, receiverId: targetId } }),
      ).toMatchObject({ status: 'PENDING' });
    } finally {
      await db.user.update({
        where: { id: me.id },
        data: {
          name,
          photo,
          college,
          degree,
          graduationYear,
          city,
          bio,
          skills,
          interests,
          domains,
          lookingFor,
          linkedin,
          github,
          instagram,
          portfolio,
          onboarded,
        },
      });
      await db.user.deleteMany({ where: { id: targetId } });
      await db.$disconnect();
    }
  },
);
