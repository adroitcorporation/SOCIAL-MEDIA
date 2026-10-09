import { test, expect } from '@playwright/test';
// Only synthetic accounts in a new, separately approved staging project.
for (const suffix of ['A', 'B']) {
  test(`synthetic account ${suffix}: Firebase password login, refresh, navigation and logout`, async ({
    page,
    context,
    request,
  }) => {
    const email = process.env['GCP_STAGING_TEST_EMAIL_' + suffix];
    const password = process.env['GCP_STAGING_TEST_PASSWORD_' + suffix];
    if (!email?.startsWith('cynk-gcp-') || !password)
      throw new Error('Configure synthetic staging test credentials securely.');
    expect((await request.get('/api/state')).status()).toBe(401);
    const forbiddenHosts = new Set<string>();
    page.on('request', (request) => {
      const hostname = new URL(request.url()).hostname;
      if (hostname.endsWith('.supabase.co') || hostname.endsWith('.onrender.com'))
        forbiddenHosts.add(hostname);
    });
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const identity = page.waitForResponse(
      (response) =>
        new URL(response.url()).hostname === 'identitytoolkit.googleapis.com' &&
        response.url().includes('accounts:signInWithPassword'),
    );
    const state = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/state' && response.status() === 200,
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const body = await (await identity).json();
    // Inspect only project audience. Never log/assert the token or credentials.
    if (typeof body.idToken !== 'string') throw new Error('Google staging login failed.');
    const claims = JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url').toString());
    // Decoding here is an observation, not token verification; the backend verifies it.
    expect(claims.aud).toBe(process.env.GCP_STAGING_AUTH_PROJECT_ID);
    expect(claims.iss).toBe(
      'https://securetoken.google.com/' + process.env.GCP_STAGING_AUTH_PROJECT_ID,
    );
    await state;
    const session = (await context.cookies()).find(
      (cookie) => cookie.name === 'circle-page-session',
    );
    expect(Boolean(session?.httpOnly && session?.secure)).toBe(true);
    for (const route of [
      '/discover',
      '/connections',
      '/messages',
      '/ideas',
      '/events',
      '/profile',
      '/notifications',
    ]) {
      await page.goto(route);
      await expect(page.locator('.auth-card')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe(route);
    }
    await page.reload();
    await expect(page.locator('.auth-card')).toHaveCount(0);
    expect(forbiddenHosts.size).toBe(0);
    await page.getByRole('button', { name: 'Log out', exact: true }).first().click();
    await expect(page.locator('.auth-card')).toHaveCount(1);
    expect((await context.cookies()).some((cookie) => cookie.name === 'circle-page-session')).toBe(
      false,
    );
  });
}
