import { test, expect, type Page } from '@playwright/test';
import type { Student, AppState } from '../../src/shared/contracts/responses';
import type { ProfileUpdateRequest } from '../../src/shared/contracts/requests';

const student: Student = {
  role: 'STUDENT',
  accountStatus: 'ACTIVE',
  id: 'profile-test',
  name: 'Aditi Sharma',
  college: 'IIT Bombay',
  degree: 'B.Tech',
  graduationYear: 2028,
  city: 'Mumbai',
  bio: 'Building tools for students.',
  skills: ['React'],
  interests: ['Technology'],
  domains: ['Web Development'],
  lookingFor: ['Project partners'],
  photo: '',
  linkedin: '',
  github: '',
  instagram: '',
  portfolio: '',
  emailVerified: true,
  collegeVerified: false,
  onboarded: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

async function openProfile(page: Page, overrides: Partial<Student> = {}) {
  const state: AppState = {
    me: { ...student, ...overrides },
    students: [],
    totalStudents: 0,
    connections: [],
    ideas: [],
    events: [],
    notifications: [],
    conversations: [],
    blockedIds: [],
  };
  const saved: ProfileUpdateRequest[] = [];
  // Isolate form interactions from the local demo and production databases.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { demo: true, configured: false } });
    if (path === '/api/state') return route.fulfill({ json: state });
    if (path === '/api/live')
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {}\n\n',
      });
    if (path === '/api/profile' && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as ProfileUpdateRequest;
      saved.push(body);
      state.me = { ...state.me, ...body, onboarded: true };
      return route.fulfill({ json: state.me });
    }
    return route.abort();
  });
  await page.goto('/profile');
  if (state.me.onboarded)
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(page.locator('.profile-form')).toBeVisible();
  return saved;
}

test('creates a profile with suggestions and custom values, leaving optional URLs empty', async ({
  page,
}) => {
  const saved = await openProfile(page, {
    name: '',
    college: '',
    degree: '',
    city: '',
    bio: '',
    skills: [],
    interests: [],
    domains: [],
    lookingFor: [],
  });
  const submit = page.getByRole('button', { name: 'Find my circle', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Full name (required)', { exact: true }).fill(student.name);
  await page.getByLabel('College (required)', { exact: true }).fill(student.college);
  await page.getByLabel('Degree / course (required)', { exact: true }).selectOption('B.Tech');
  const year = page.getByRole('combobox', { name: 'Graduation year (required)', exact: true });
  await expect(year.locator('option')).toHaveCount(22);
  await expect(year.locator('option[value="2020"]')).toHaveCount(1);
  await expect(year.locator('option[value="2040"]')).toHaveCount(1);
  await year.selectOption('2028');
  await page.getByLabel('City (required)', { exact: true }).selectOption('Mumbai');
  await page.getByLabel('Bio (required)', { exact: true }).fill(student.bio);
  await page.getByRole('checkbox', { name: 'React', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Technology', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Web Development', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Project partners', exact: true }).check();
  await page.locator('#profile-skills').fill('React, Robotics');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({
    name: student.name,
    degree: 'B.Tech',
    graduationYear: 2028,
    city: 'Mumbai',
    skills: ['React', 'Robotics'],
    photo: '',
    linkedin: '',
    github: '',
    instagram: '',
    portfolio: '',
  });
});

for (const field of [
  'name',
  'college',
  'degree',
  'graduationYear',
  'city',
  'bio',
  'skills',
  'interests',
  'domains',
  'lookingFor',
]) {
  test(`blocks submission and shows a field error when ${field} is empty`, async ({ page }) => {
    const saved = await openProfile(page);
    const input = page.locator(`#profile-${field}`);
    await input.focus();
    if (['degree', 'graduationYear', 'city'].includes(field)) await input.selectOption('');
    else
      await input.fill(
        ['skills', 'interests', 'domains', 'lookingFor'].includes(field) ? ' , , ' : '   ',
      );
    await input.blur();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#profile-${field}-error`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find my circle', exact: true })).toBeDisabled();
    await page
      .locator('form.profile-form')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    expect(saved).toHaveLength(0);
  });
}

test('preserves saved custom values when editing and toggling suggestions', async ({ page }) => {
  const existing = {
    onboarded: true,
    degree: 'B.Des',
    city: 'Pilani',
    skills: ['Robotics'],
    interests: ['Astronomy'],
    domains: ['Space technology'],
    lookingFor: ['Study partners'],
    github: 'https://github.com/student',
  };
  const saved = await openProfile(page, existing);
  await expect(page.getByLabel('Specify degree / course (required)', { exact: true })).toHaveValue(
    'B.Des',
  );
  await expect(page.getByLabel('Specify city (required)', { exact: true })).toHaveValue('Pilani');
  await page.getByRole('checkbox', { name: 'React', exact: true }).check();
  await expect(page.locator('#profile-skills')).toHaveValue('Robotics, React');
  await page.getByRole('checkbox', { name: 'React', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  const { onboarded: _, ...profile } = existing;
  expect(saved[0]).toMatchObject(profile);
});

test('accepts Other degree and city and safely validates optional URLs', async ({ page }) => {
  const saved = await openProfile(page);
  await page.locator('#profile-degree').selectOption({ label: 'Other' });
  await expect(page.getByRole('button', { name: 'Find my circle', exact: true })).toBeDisabled();
  await page.getByLabel('Specify degree / course (required)', { exact: true }).fill('B.Arch');
  await page.locator('#profile-city').selectOption({ label: 'Other' });
  await page.getByLabel('Specify city (required)', { exact: true }).fill('Udaipur');
  await page.locator('#profile-portfolio').fill('not a URL');
  await page.locator('#profile-portfolio').blur();
  await expect(page.locator('#profile-portfolio-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find my circle', exact: true })).toBeDisabled();
  await page.locator('#profile-portfolio').fill('');
  await page.getByRole('button', { name: 'Find my circle', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({ degree: 'B.Arch', city: 'Udaipur', portfolio: '' });
});

test('keeps the profile form within a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Find my circle', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('profile-mobile.png'), fullPage: true });
});

test('new users can browse every regular section before completing their profile', async ({
  page,
}) => {
  await openProfile(page);
  for (const path of [
    '/',
    '/discover',
    '/connections',
    '/ideas',
    '/events',
    '/messages',
    '/notifications',
  ]) {
    await page.goto(path);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.profile-form')).toHaveCount(0);
    await expect(page.locator('main.page-content')).toBeVisible();
  }
});

test('college ID input clears an earlier valid file when an invalid replacement is selected', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'College ID', exact: true }).click();
  const input = page.getByLabel('College ID image');
  const submit = page.getByRole('button', { name: 'Submit for review' });
  await input.setInputFiles({
    name: 'id.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fixture'),
  });
  await expect(submit).toBeEnabled();
  await input.setInputFiles({
    name: 'id.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(submit).toBeDisabled();
  await expect(input).toHaveValue('');
});
