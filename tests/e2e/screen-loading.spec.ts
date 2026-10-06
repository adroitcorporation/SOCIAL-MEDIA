import { expect, test } from '@playwright/test';

test('first load still waits for usable state and reports a failed request', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/state?**', async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { error: 'State service unavailable' } });
  });
  try {
    await page.goto('/connections');
    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByText('State service unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

for (const status of [401, 403, 503]) {
  test(`a failed navigation (${status}) clears private state and shows the failure`, async ({
    page,
  }) => {
    await page.goto('/events');
    await expect(page.locator('.event-card').first()).toBeVisible();
    await page.route('**/api/state?**', (route) =>
      route.fulfill({
        status,
        json: { error: 'Destination unavailable' },
      }),
    );
    await page.locator('.sidebar').getByRole('link', { name: 'Connections', exact: true }).click();
    if (status === 401)
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    else await expect(page.getByText('Destination unavailable', { exact: true })).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);
    await expect(page.locator('.connection-card, .event-card')).toHaveCount(0);
  });
}

test('switching to connections keeps the shell while destination state loads', async ({ page }) => {
  await page.goto('/events');
  await expect(page.locator('.event-card').first()).toBeVisible();
  const shell = await page.locator('.app-shell').elementHandle();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/api/state?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('view') === '/connections') {
      requested();
      await pending;
    }
    await route.continue();
  });
  try {
    await page.locator('.sidebar').getByRole('link', { name: 'Connections', exact: true }).click();
    await requestStarted;
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.topbar')).toBeVisible();
    expect(await shell!.evaluate((node) => node.isConnected)).toBe(true);
    // The events snapshot has no connections: do not present it as an empty connections result.
    await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
  await expect(page.locator('.connection-card').first()).toBeVisible();
  expect(await shell!.evaluate((node) => node.isConnected)).toBe(true);
});

test('returning to a visited screen renders its cached state while it refreshes', async ({
  page,
}) => {
  await page.goto('/events');
  await expect(page.locator('.event-card').first()).toBeVisible();
  await page.locator('.sidebar').getByRole('link', { name: 'Connections', exact: true }).click();
  await expect(page.locator('.connection-card').first()).toBeVisible();

  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/api/state?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('view') === '/events') {
      requested();
      await pending;
    }
    await route.continue();
  });

  try {
    await page.locator('.sidebar').getByRole('link', { name: 'Events', exact: true }).click();
    await requestStarted;
    await expect(page.locator('.event-card').first()).toBeVisible();
  } finally {
    release();
  }
});

test('hover-prefetched state renders immediately while the destination refreshes', async ({
  page,
}) => {
  await page.goto('/events');
  await expect(page.locator('.event-card').first()).toBeVisible();
  let connectionsReads = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let refreshStarted!: () => void;
  const refreshRequested = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  let prefetchFinished!: () => void;
  const prefetchCompleted = new Promise<void>((resolve) => {
    prefetchFinished = resolve;
  });
  await page.route('**/api/state?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('view') === '/connections') {
      connectionsReads++;
      if (connectionsReads === 2) {
        refreshStarted();
        await pending;
      }
      await route.continue();
      if (connectionsReads === 1) prefetchFinished();
      return;
    }
    await route.continue();
  });
  const link = page.locator('.sidebar').getByRole('link', { name: 'Connections', exact: true });
  try {
    await link.hover();
    await prefetchCompleted;
    await link.click();
    await refreshRequested;
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await expect(page.locator('.connection-card').first()).toBeVisible();
    expect(connectionsReads).toBe(2);
  } finally {
    release();
  }
});

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
  let configReads = 0;
  await page.route('**/api/config', (route) => {
    configReads++;
    return route.fulfill({ json: { demo: false, configured: true } });
  });
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
  const initialConfigReads = configReads;
  for (const [name, selector] of [
    ['Discover', '.discover-single .student-card'],
    ['Events', '.event-card'],
    ['Discover', '.discover-single .student-card'],
  ]) {
    const before = stateReads.length;
    await page.locator('.sidebar').getByRole('link', { name, exact: true }).click();
    await expect(page.locator(selector).first()).toBeVisible();
    expect(stateReads).toHaveLength(before + 1);
    expect(bridgePosts).toBe(1);
    expect(configReads).toBe(initialConfigReads);
  }
});
