import { test, expect } from '@playwright/test';
import { PrismaClient, type UserRole } from '@prisma/client';
import sharp from 'sharp';
import type {
  AppState,
  Student,
  VerificationReviewItem,
} from '../../src/shared/contracts/responses';

const user: Student = {
  role: 'MODERATOR',
  accountStatus: 'ACTIVE',
  id: 'reviewer',
  name: 'Moderator',
  college: 'Test College',
  degree: 'B.Tech',
  graduationYear: 2028,
  city: 'Pune',
  bio: 'Building together.',
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
  onboarded: true,
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
};
const state: AppState = {
  me: user,
  students: [],
  totalStudents: 0,
  connections: [],
  ideas: [],
  events: [],
  notifications: [],
  conversations: [],
  blockedIds: [],
  isModerator: true,
};

// Server-rendered permission checks cannot be replaced by browser API mocks.
// Use only the fixed loopback demo database, restoring its role after each check.
let originalRole: UserRole | undefined;
const localDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
    },
  },
});
test.beforeEach(async ({ request }, info) => {
  expect((await (await request.get('/api/config')).json()).demo).toBe(true);
  originalRole = (await localDb.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } })).role;
  await localDb.user.update({
    where: { id: 'demo-aarav' },
    data: {
      role: info.title.startsWith('ultimate')
        ? 'ULTIMATE_MODERATOR'
        : info.title.startsWith('moderators')
          ? 'MODERATOR'
          : 'STUDENT',
    },
  });
});
test.afterEach(async () => {
  if (originalRole)
    await localDb.user.update({ where: { id: 'demo-aarav' }, data: { role: originalRole } });
});
test.afterAll(async () => {
  await localDb.$disconnect();
});

test('moderators can inspect private images and submit approve/reject decisions with notes', async ({
  page,
}) => {
  let pending: VerificationReviewItem[] = ['id-request', 'email-request'].map((id) => ({
    id,
    userId: 'applicant',
    method: id === 'id-request' ? 'COLLEGE_ID' : 'EMAIL',
    collegeEmail: id === 'email-request' ? 'student@college.edu' : null,
    status: 'PENDING',
    reviewerId: null,
    reviewedAt: null,
    reviewNote: '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    user: {
      ...user,
      id: 'applicant',
      name: id === 'id-request' ? 'ID Applicant' : 'Email Applicant',
    },
  }));
  const decisions: unknown[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { demo: true, configured: false } });
    if (path === '/api/state') return route.fulfill({ json: state });
    if (path === '/api/live')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {}\n\n',
      });
    if (path === '/api/moderation/verifications') return route.fulfill({ json: pending });
    if (path.endsWith('/document'))
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSu8AAAAASUVORK5CYII=',
          'base64',
        ),
      });
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      decisions.push(body);
      const id = path.split('/').pop();
      const item = pending.find((item) => item.id === id);
      pending = pending.filter((item) => item.id !== id);
      return route.fulfill({ json: { ...item, ...body, reviewerId: user.id } });
    }
    return route.abort();
  });
  await page.goto('/moderation');
  await page.getByRole('button', { name: 'Verification', exact: true }).click();
  const idCard = page.locator('article').filter({ hasText: 'ID Applicant' });
  const image = idCard.getByRole('img', { name: 'College ID submitted by ID Applicant' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await idCard.getByLabel('Review note').fill('Please upload a clearer image.');
  await idCard.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(idCard).toHaveCount(0);
  const emailCard = page.locator('article').filter({ hasText: 'Email Applicant' });
  await expect(emailCard).toContainText('student@college.edu');
  await emailCard.getByLabel('Review note').fill('College email confirmed.');
  await emailCard.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Nothing waiting for review.')).toBeVisible();
  expect(decisions).toEqual([
    { status: 'REJECTED', reviewNote: 'Please upload a clearer image.' },
    { status: 'APPROVED', reviewNote: 'College email confirmed.' },
  ]);
});

test('an unauthorized moderation page displays the access error instead of an empty queue', async ({
  page,
}) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { demo: true, configured: false } });
    if (path === '/api/state')
      return route.fulfill({
        json: { ...state, me: { ...user, role: 'STUDENT' }, isModerator: false },
      });
    if (path === '/api/live')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {}\n\n',
      });
    return route.fulfill({ status: 403, json: { error: 'Moderator access required.' } });
  });
  await page.goto('/moderation');
  await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
  await expect(page.getByText('An active moderator account is required.')).toBeVisible();
  await expect(page.getByText('Nothing waiting for review.')).toHaveCount(0);
});

test('ultimate moderator adds and revokes a domain through the real dashboard and backend', async ({
  page,
}) => {
  const domain = `ui-${Date.now()}.college.ac.in`;
  try {
    await page.goto('/moderation');
    await page
      .getByRole('textbox', { name: 'Approved email domain' })
      .fill(`@${domain.toUpperCase()}`);
    const college = await localDb.college.findFirstOrThrow({ where: { active: true } });
    await page.getByRole('textbox', { name: 'Search college (optional)' }).fill(college.name);
    await expect(
      page
        .locator('select[aria-label="Associate college (optional)"] option')
        .filter({ hasText: college.name }),
    ).toBeAttached();
    await page
      .getByRole('combobox', { name: 'Associate college (optional)' })
      .selectOption(college.id);
    await page.getByRole('button', { name: 'Add domain', exact: true }).click();
    const remove = page.getByRole('button', { name: `Remove ${domain}`, exact: true });
    await expect(remove).toBeVisible();
    expect(await localDb.approvedCollegeDomain.findUnique({ where: { domain } })).toMatchObject({
      collegeId: college.id,
    });
    await remove.click();
    await expect(remove).toHaveCount(0);
    expect(await localDb.approvedCollegeDomain.findUnique({ where: { domain } })).toBeNull();
  } finally {
    await localDb.approvedCollegeDomain.deleteMany({ where: { domain } });
  }
});

test('a confirmed student uploads a private college ID through the real browser and backend', async ({
  page,
}) => {
  const original = await localDb.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } });
  let requestId: string | undefined;
  expect(
    await localDb.collegeVerificationRequest.count({
      where: { userId: original.id, status: 'PENDING' },
    }),
  ).toBe(0);
  try {
    await localDb.user.update({
      where: { id: original.id },
      data: { emailVerified: true, collegeVerified: false, collegeVerificationSource: null },
    });
    await page.goto('/profile');
    await page.getByRole('button', { name: 'College ID', exact: true }).click();
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#234567' },
    })
      .png()
      .toBuffer();
    await page
      .locator('.verification-panel input[type="file"]')
      .setInputFiles({ name: 'test-college-id.png', mimeType: 'image/png', buffer });
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/verification') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Submit for review' }).click();
    const submitted = await response;
    expect(submitted.status()).toBe(200);
    const body = await submitted.json();
    requestId = body.id;
    expect(body).toMatchObject({ status: 'PENDING', userId: original.id });
    expect(body).not.toHaveProperty('documentBytes');
    const row = await localDb.collegeVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(row.documentMime).toBe('image/png');
    expect(row.documentBytes?.length).toBeGreaterThan(0);
    expect(row.documentUrl).toBeNull();
    await expect(page.getByText('Your ID submission is under moderator review.')).toBeVisible();
  } finally {
    if (requestId) await localDb.collegeVerificationRequest.delete({ where: { id: requestId } });
    await localDb.user.update({
      where: { id: original.id },
      data: {
        emailVerified: original.emailVerified,
        collegeVerified: original.collegeVerified,
        collegeVerificationSource: original.collegeVerificationSource,
      },
    });
  }
});
