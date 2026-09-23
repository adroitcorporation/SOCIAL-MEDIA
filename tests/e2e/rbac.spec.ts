import { test, expect } from '@playwright/test';

// Run against an isolated local demo with demo-aarav bootstrapped as Ultimate Moderator.
test.beforeEach(async ({ request }) => {
  const config = await (await request.get('/api/config')).json();
  test.skip(!config.demo, 'Requires the isolated local demo.');
  const state = await (await request.get('/api/state')).json();
  test.skip(
    state.me?.role !== 'ULTIMATE_MODERATOR',
    'Bootstrap demo-aarav before running RBAC browser tests.',
  );
});

test('ultimate moderator creates, edits and deletes a persisted event', async ({
  page,
  request,
}) => {
  const title = `RBAC workshop ${Date.now()}`;
  let eventId: string | undefined;
  try {
    await page.goto('/events');
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title', { exact: true }).fill(title);
    await dialog.getByLabel('Description', { exact: true }).fill('A real end-to-end workshop.');
    await dialog.getByLabel('Category', { exact: true }).fill('Workshop');
    await dialog.getByLabel('Organiser name').fill('Community team');
    await dialog.getByLabel('Location', { exact: true }).fill('Campus hall');
    await dialog.getByLabel('Start time').fill('2027-01-01T10:00');
    await dialog.getByLabel('Event website').fill('https://example.com/workshop');
    await dialog.getByRole('button', { name: 'Save event' }).click();
    await expect(dialog).toHaveCount(0);
    const managed = await (await request.get('/api/events/managed')).json();
    eventId = managed.find((event: { title: string }) => event.title === title).id;
    const row = page.locator('.managed-event').filter({ hasText: title });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill(`${title} updated`);
    await page.getByRole('dialog').getByRole('button', { name: 'Save event' }).click();
    await expect(row).toContainText(`${title} updated`);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion' }).click();
    await expect(row).toHaveCount(0);
    expect(
      (await (await request.get('/api/events/managed')).json()).some(
        (event: { id: string }) => event.id === eventId,
      ),
    ).toBe(false);
  } finally {
    if (eventId) await request.delete(`/api/events/${eventId}`, { data: {} });
  }
});

test('role assignment, suspension and report resolution persist through the dashboard', async ({
  page,
  request,
}) => {
  const targetId = 'demo-ananya';
  const complaint = `Browser test complaint ${Date.now()}`;
  await request.patch(`/api/moderation/users/${targetId}/status`, {
    data: { accountStatus: 'ACTIVE', reason: 'Prepare isolated browser fixture.' },
  });
  await request.patch(`/api/moderation/users/${targetId}/role`, {
    data: { role: 'STUDENT', reason: 'Prepare isolated browser fixture.' },
  });
  try {
    await page.goto('/moderation/roles');
    await page.getByLabel('Search users').fill(targetId);
    const user = page.locator('form.moderation-item').filter({ hasText: targetId });
    await expect(user).toBeVisible();
    await user.getByLabel('Assign role').selectOption('ORGANISER');
    await user.getByLabel('Reason', { exact: true }).fill('Browser test organiser approval.');
    await user.getByRole('button', { name: 'Save role', exact: true }).click();
    await expect(user.locator('.tag').first()).toHaveText('Organiser');
    await page.getByRole('link', { name: 'Back to dashboard' }).click();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.getByLabel('Search users').fill(targetId);
    await user.getByLabel('Account status').selectOption('SUSPENDED');
    await user.getByLabel('Reason', { exact: true }).fill('Browser test account restriction.');
    await user.getByRole('button', { name: 'Save status', exact: true }).click();
    await expect(user.locator('.tag').nth(1)).toHaveText('SUSPENDED');
    const reported = await request.post('/api/reports', { data: { targetId, reason: complaint } });
    expect(reported.ok()).toBe(true);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    const report = page.locator('form.moderation-item').filter({ hasText: complaint });
    await expect(report).toBeVisible();
    await report.getByLabel('Report decision').selectOption('RESOLVED');
    await report.getByLabel('Review reason').fill('Investigated and resolved in browser test.');
    await report.getByRole('button', { name: 'Save decision' }).click();
    await expect(report).toHaveCount(0);
    await page.getByLabel('Report status', { exact: true }).selectOption('RESOLVED');
    await expect(report).toContainText('Investigated and resolved');
  } finally {
    await request.patch(`/api/moderation/users/${targetId}/status`, {
      data: { accountStatus: 'ACTIVE', reason: 'Restore browser test fixture.' },
    });
    await request.patch(`/api/moderation/users/${targetId}/role`, {
      data: { role: 'STUDENT', reason: 'Restore browser test fixture.' },
    });
  }
});
