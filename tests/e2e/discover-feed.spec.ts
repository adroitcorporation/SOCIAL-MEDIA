import { test, expect, type Page } from '@playwright/test';
import type { AppState, Student } from '../../src/shared/contracts/responses';

function student(id: string): Student {
  return {
    id,
    name: `Student ${id}`,
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    college: 'Test College',
    degree: 'B.Tech',
    graduationYear: 2028,
    city: 'Jaipur',
    bio: '',
    photo: '',
    skills: [],
    interests: [],
    domains: [],
    lookingFor: [],
    linkedin: '',
    github: '',
    instagram: '',
    portfolio: '',
    emailVerified: true,
    collegeVerified: true,
    onboarded: true,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };
}

async function openFeed(page: Page) {
  const students = ['A', 'B', 'C'].map(student);
  const state: AppState = {
    me: student('me'),
    students,
    totalStudents: 3,
    connections: [],
    ideas: [],
    events: [],
    notifications: [],
    conversations: [],
    blockedIds: [],
  };
  const actions: string[] = [];
  const controls = { fail: false };
  // Catch every API call: no connection or skip can reach a real account/database.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { demo: true, configured: false } });
    if (url.pathname === '/api/state') return route.fulfill({ json: state });
    if (url.pathname === '/api/live')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {}\n\n',
      });
    if (url.pathname === '/api/connections' && request.method() === 'POST') {
      const { userId } = request.postDataJSON();
      actions.push(`connect:${userId}`);
      if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
      // PENDING deliberately leaves the requested profile in state.students.
      return route.fulfill({
        json: {
          id: `connection-${userId}`,
          pairKey: `me:${userId}`,
          requesterId: 'me',
          receiverId: userId,
          status: 'PENDING',
          createdAt: state.me.createdAt,
          updatedAt: state.me.updatedAt,
        },
      });
    }
    if (url.pathname.startsWith('/api/skips/') && request.method() === 'POST') {
      const id = url.pathname.split('/').pop();
      actions.push(`pass:${id}`);
      if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
      state.students = state.students.filter((entry) => entry.id !== id);
      state.totalStudents = state.students.length;
      return route.fulfill({ json: { ok: true } });
    }
    return route.abort();
  });
  await page.goto('/discover');
  await expect(page.locator('.student-name')).toHaveText('Student A');
  return { actions, controls };
}

test('pending Connect and shrinking Pass advance once, exhaust, and reset on query change', async ({
  page,
}) => {
  const { actions } = await openFeed(page);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.locator('.student-name')).toHaveText('Student B');
  await expect(page.getByRole('button', { name: 'Cancel Request' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip Student B', exact: true }).click();
  await expect(page.locator('.student-name')).toHaveText('Student C');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText("You're all caught up.", { exact: true })).toBeVisible();
  await expect(page.locator('.student-card')).toHaveCount(0);
  expect(actions).toEqual(['connect:A', 'pass:B', 'connect:C']);
  await page.getByPlaceholder('Name, college, city').fill('Student');
  await page.getByRole('button', { name: 'Search profiles' }).click();
  await expect(page).toHaveURL(/search=Student/);
  await expect(page.locator('.student-name')).toHaveText('Student A');
});

test('failed Connect and Pass keep the current profile, then allow a successful retry', async ({
  page,
}) => {
  const { actions, controls } = await openFeed(page);
  controls.fail = true;
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Action failed', { exact: true })).toBeVisible();
  await expect(page.locator('.student-name')).toHaveText('Student A');
  await page.getByRole('button', { name: 'Skip Student A', exact: true }).click();
  await expect.poll(() => actions.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled();
  await expect(page.locator('.student-name')).toHaveText('Student A');
  controls.fail = false;
  await page.getByRole('button', { name: 'Skip Student A', exact: true }).click();
  await expect(page.locator('.student-name')).toHaveText('Student B');
  expect(actions).toEqual(['connect:A', 'pass:A', 'pass:A']);
});
