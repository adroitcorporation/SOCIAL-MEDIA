import { expect, test } from '@playwright/test';

test('screen navigation loads state once without repeating the same-token session bridge', async ({
  page,
  request,
}) => {
  expect((await (await request.get('/api/config')).json()).demo).toBe(true);
  const user = {
    id: 'synthetic-navigation-user',
    email: 'synthetic@lnmiit.ac.in',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    'eyJhbGciOiJIUzI1NiJ9',
    Buffer.from(
      JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url'),
    'synthetic',
  ].join('.');
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { demo: false, configured: true } }),
  );
  await page.route('**/api/live', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: 'event: ready\ndata: {}\n\n' }),
  );
  // Only provider credentials and cookie writes are simulated. State reads use the local API.
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: 'synthetic-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user,
      },
    }),
  );
  let bridgePosts = 0;
  await page.route('**/session', (route) => {
    if (route.request().method() === 'POST') bridgePosts++;
    return route.fulfill({ json: { ok: true } });
  });
  const stateReads: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/state') stateReads.push(req.url());
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.student-card').first()).toBeVisible();
  expect(bridgePosts).toBe(1);
  for (const [name, selector] of [
    ['Discover', '.discover-grid .student-card'],
    ['Events', '.event-card'],
    ['Discover', '.discover-grid .student-card'],
  ]) {
    const before = stateReads.length;
    await page.locator('.sidebar').getByRole('link', { name, exact: true }).click();
    await expect(page.locator(selector).first()).toBeVisible();
    expect(stateReads).toHaveLength(before + 1);
    expect(bridgePosts).toBe(1);
  }
});
