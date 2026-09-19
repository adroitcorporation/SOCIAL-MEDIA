import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => {
  const config = await (await request.get('/api/config')).json();
  expect(config.demo, 'Browser tests are restricted to the local sample database').toBe(true);
});
test('request can be cancelled after refresh, persisted, and sent again', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  const previous = state.connections.find(
    (c: { receiverId: string; status: string }) =>
      c.receiverId === 'demo-ananya' && c.status === 'PENDING',
  );
  if (previous)
    await request.patch(`/api/connections/${previous.id}`, { data: { action: 'cancel' } });
  await page.goto('/discover');
  const card = page
    .locator('.student-card')
    .filter({
      has: page.getByRole('button', { name: 'Ananya Sharma Email verified', exact: true }),
    });
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(card.getByText('Request Sent')).toBeVisible();
  await page.reload();
  await card.getByRole('button', { name: 'Cancel Request' }).click();
  await expect(card.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  const updated = await (await request.get('/api/state')).json();
  expect(
    updated.connections.some((c: { receiverId: string }) => c.receiverId === 'demo-ananya'),
  ).toBe(false);
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(card.getByText('Request Sent')).toBeVisible();
  await page.goto('/connections');
  await page.getByRole('button', { name: /Sent Requests/ }).click();
  await page
    .locator('.connection-card')
    .filter({ hasText: 'Ananya Sharma' })
    .getByRole('button', { name: 'Cancel Request' })
    .click();
  await expect(page.getByText('No requests out in the world.')).toBeVisible();
});
test('create accepted-connection group, message, promote, remove, and delete', async ({ page }) => {
  await page.goto('/messages');
  await page.getByRole('button', { name: 'Create Group', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Group name').fill('Browser test collaboration');
  await expect(dialog.getByText('Kabir Sethi')).toBeVisible();
  await expect(dialog.getByText('Tara Nair')).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: /Kabir Sethi/ }).check();
  await dialog.getByRole('checkbox', { name: /Isha Rao/ }).check();
  await dialog.getByRole('button', { name: 'Create group', exact: true }).click();
  await expect(page.locator('.chat-header')).toContainText('Browser test collaboration');
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Hello from the browser regression test.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.message-scroll')).toContainText(
    'Hello from the browser regression test.',
  );
  await page.reload();
  await expect(page.locator('.message-scroll')).toContainText(
    'Hello from the browser regression test.',
  );
  await page.getByRole('button', { name: 'Members' }).click();
  const kabir = dialog.locator('.member-row').filter({ hasText: 'Kabir Sethi' });
  await kabir.getByRole('button', { name: 'Make admin', exact: true }).click();
  await expect(kabir.getByText('admin', { exact: true })).toBeVisible();
  await dialog
    .locator('.member-row')
    .filter({ hasText: 'Isha Rao' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(dialog.locator('.member-row').filter({ hasText: 'Isha Rao' })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Select new member' }).selectOption('demo-isha');
  await dialog.getByRole('button', { name: 'Add member' }).click();
  await expect(dialog.locator('.member-row').filter({ hasText: 'Isha Rao' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete group', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(
    page.locator('.conversation-row').filter({ hasText: 'Browser test collaboration' }),
  ).toHaveCount(0);
});
test('idea owner reuses the same group when adding another resonator', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json();
  const existing = state.conversations.find((c: { ideaId: string }) => c.ideaId === 'seed-idea-3');
  if (existing)
    await request.patch(`/api/conversations/${existing.id}`, { data: { action: 'delete' } });
  await page.goto('/ideas');
  await page
    .getByRole('button', { name: 'A little map of everything happening on campus', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Select Rohan Iyer' }).check();
  await page.getByRole('button', { name: 'Create collaboration group' }).click();
  await expect(page.locator('.chat-header')).toContainText('A little map');
  const firstUrl = page.url();
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('The first group keeps this history.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.message-scroll')).toContainText(
    'The first group keeps this history.',
  );
  await page.goto('/ideas');
  await page
    .getByRole('button', { name: 'A little map of everything happening on campus', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Select Meera Patel' }).check();
  await page.getByRole('button', { name: 'Add selected (1)' }).click();
  await expect(page).toHaveURL(firstUrl);
  await expect(page.locator('.message-scroll')).toContainText(
    'The first group keeps this history.',
  );
  await page.getByRole('button', { name: 'Members' }).click();
  await expect(page.getByRole('dialog').getByText('Rohan Iyer')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Meera Patel')).toBeVisible();
});
test('stream refreshes connection state in a second open browser', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/connections');
  await page.getByRole('button', { name: /Sent Requests/ }).click();
  const other = await context.newPage();
  await other.goto('/discover');
  const card = other.locator('.student-card').filter({ hasText: 'Zoya Khan' });
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.locator('.connection-card').filter({ hasText: 'Zoya Khan' })).toBeVisible({
    timeout: 15000,
  });
  await page
    .locator('.connection-card')
    .filter({ hasText: 'Zoya Khan' })
    .getByRole('button', { name: 'Cancel Request' })
    .click();
  await expect(card.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({
    timeout: 15000,
  });
  await other.close();
});
test('all routes render on mobile without overflow or browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/',
    '/discover',
    '/connections',
    '/ideas',
    '/events',
    '/messages',
    '/notifications',
    '/profile',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `Horizontal overflow on ${route}`).toBe(false);
    await expect(page.locator('.bottom-nav')).toBeVisible();
  }
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Big ideas start with a small hello.' }),
  ).toBeVisible();
  await page.screenshot({ path: '.local/home-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
