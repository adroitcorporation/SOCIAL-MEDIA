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
  // Block all real Supabase requests, including Storage; individual tests override this.
  await page.route('https://**.supabase.co/**', (route) => route.abort());
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
  await page
    .getByLabel('College (required)', { exact: true })
    .selectOption({ label: 'College of Jaipur' });
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
    college: 'College of Jaipur',
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

test('rejects unsupported profile photo files before upload', async ({ page }) => {
  await openProfile(page);
  await page.locator('#profile-photo-upload').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.locator('.profile-photo-field [role="alert"]')).toHaveText(
    'Choose a JPG, PNG, or WebP image up to 4 MB.',
  );
  await expect(page.locator('.profile-photo-control .avatar img')).toHaveCount(0);
});

const photoFile = {
  name: 'portrait.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8/8AAAAASUVORK5CYII=',
    'base64',
  ),
};

async function mockPhotoSession(page: Page, userId = student.id) {
  await page.addInitScript(
    ({ userId }) => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (/^sb-.*-auth-token$/.test(key))
          return JSON.stringify({
            access_token: 'mock-photo-token',
            refresh_token: 'mock-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user: { id: userId },
          });
        return original.call(this, key);
      };
    },
    { userId },
  );
}

test('previews a photo while uploading, then saves its public URL in the owner folder', async ({
  page,
}) => {
  await mockPhotoSession(page);
  const saved = await openProfile(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const uploads: string[] = [];
  await page.route('**/storage/v1/object/**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST')
      return route.fulfill({ contentType: 'image/png', body: photoFile.buffer });
    const path = new URL(request.url()).pathname;
    uploads.push(path);
    expect(request.headers().authorization).toBe('Bearer mock-photo-token');
    expect(request.headers()['x-upsert']).toBe('false');
    await waiting;
    return route.fulfill({ json: { Key: path.split('/object/')[1] } });
  });
  await page.locator('#profile-photo-upload').setInputFiles(photoFile);
  await expect.poll(() => uploads.length).toBe(1);
  const preview = page.locator('.profile-photo-control img');
  await expect(preview).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Find my circle', exact: true })).toBeDisabled();
  await page.locator('form.profile-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(saved).toHaveLength(0);
  release();
  await expect(preview).toHaveAttribute(
    'src',
    /^https:.*\/storage\/v1\/object\/public\/profile-photos\/profile-test\/.*\.png$/,
  );
  expect(uploads[0]).toMatch(/^\/storage\/v1\/object\/profile-photos\/profile-test\/[\w-]+\.png$/);
  const publicUrl = await preview.getAttribute('src');
  await page.getByRole('button', { name: 'Find my circle', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].photo).toBe(publicUrl);
});

test('failed upload preserves the saved photo and allows profile save', async ({ page }) => {
  await mockPhotoSession(page);
  const originalPhoto = 'https://images.example.test/old.png';
  await page.route(originalPhoto, (route) =>
    route.fulfill({ contentType: 'image/png', body: photoFile.buffer }),
  );
  const saved = await openProfile(page, { photo: originalPhoto });
  await page.route('**/storage/v1/object/profile-photos/**', (route) =>
    route.fulfill({
      status: 403,
      json: { statusCode: '403', error: 'Forbidden', message: 'Upload denied' },
    }),
  );
  await page.locator('#profile-photo-upload').setInputFiles(photoFile);
  await expect(page.locator('.profile-photo-field [role="alert"]')).toBeVisible();
  await expect(page.locator('.profile-photo-control img')).toHaveAttribute('src', originalPhoto);
  await page.getByRole('button', { name: 'Find my circle', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].photo).toBe(originalPhoto);
});

test('explains how to configure Storage when the profile photo bucket is missing', async ({
  page,
}) => {
  await mockPhotoSession(page);
  await openProfile(page);
  await page.route('**/storage/v1/object/profile-photos/**', (route) =>
    route.fulfill({ status: 404, json: { statusCode: '404', message: 'Bucket not found' } }),
  );
  await page.locator('#profile-photo-upload').setInputFiles(photoFile);
  await expect(page.locator('.profile-photo-field [role="alert"]')).toHaveText(
    'Profile photo storage is not set up. Run supabase/profile-photos.sql in the Supabase project configured for this app.',
  );
  await expect(page.locator('.profile-photo-control img')).toHaveCount(0);
});

test('rejects oversized photos before any Storage request', async ({ page }) => {
  await mockPhotoSession(page);
  await openProfile(page);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/storage/v1/')) requests.push(request.url());
  });
  await page
    .locator('#profile-photo-upload')
    .setInputFiles({ ...photoFile, buffer: Buffer.alloc(4_000_001) });
  await expect(page.locator('.profile-photo-field [role="alert"]')).toHaveText(
    'Choose a JPG, PNG, or WebP image up to 4 MB.',
  );
  expect(requests).toHaveLength(0);
  await expect(page.locator('.profile-photo-control img')).toHaveCount(0);
});

test('rejects a session belonging to a different profile owner', async ({ page }) => {
  await mockPhotoSession(page, 'different-user');
  await openProfile(page);
  await page.locator('#profile-photo-upload').setInputFiles(photoFile);
  await expect(page.locator('.profile-photo-field [role="alert"]')).toHaveText(
    'Sign in to your account before uploading a profile photo.',
  );
  await expect(page.locator('.profile-photo-control img')).toHaveCount(0);
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
    if (['college', 'degree', 'graduationYear', 'city'].includes(field))
      await input.selectOption('');
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
