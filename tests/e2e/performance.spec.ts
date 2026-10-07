import { expect } from '@playwright/test';
import { test } from './verified-demo';
import type { AppState } from '../../src/shared/contracts/responses';

test.beforeEach(async ({ request }) => {
  expect((await (await request.get('/api/config')).json()).demo).toBe(true);
});

test('sending chat fetches only the delta and does not reload app state', async ({
  page,
  request,
}) => {
  const state: AppState = await (await request.get('/api/state')).json();
  const connection = state.connections.find((item) => item.status === 'ACCEPTED')!;
  const userId =
    connection.requesterId === state.me.id ? connection.receiverId : connection.requesterId;
  const conversation = await (
    await request.post('/api/conversations', { data: { type: 'DIRECT', userId } })
  ).json();
  expect(conversation.id).toBeTruthy();
  const seed = await request.post(`/api/conversations/${conversation.id}/messages`, {
    data: { body: 'Cursor fixture', clientId: crypto.randomUUID() },
  });
  expect(seed.ok()).toBe(true);
  const reads: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes('/api/')) reads.push(req.url());
  });
  await page.goto(`/messages?conversation=${conversation.id}`);
  await expect(page.locator('.message')).not.toHaveCount(0);
  const stateReads = reads.filter((url) => url.includes('/api/state')).length;
  const text = `Incremental performance check ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.message-scroll')).toContainText(text);
  expect(reads.some((url) => url.includes('/messages?after='))).toBe(true);
  expect(reads.filter((url) => url.includes('/api/state'))).toHaveLength(stateReads);
});

test('connection actions update the card without a state refetch', async ({ page, request }) => {
  const state: AppState = await (await request.get('/api/state')).json();
  const student = state.students.find(
    (student) =>
      !state.connections.some((connection) =>
        [connection.requesterId, connection.receiverId].includes(student.id),
      ),
  );
  expect(student).toBeTruthy();
  const reads: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/state')) reads.push(req.url());
  });
  await page.goto(`/discover?search=${encodeURIComponent(student!.name)}`);
  const card = page.locator('.student-card').filter({ hasText: student!.name });
  await expect(card).toBeVisible();
  const initial = reads.length;
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Pending', exact: true })).toBeDisabled();
  expect(reads).toHaveLength(initial);
  const updated: AppState = await (await request.get('/api/state?view=/connections')).json();
  const sent = updated.connections.find(
    (c) => c.receiverId === student!.id && c.status === 'PENDING',
  );
  expect(sent).toBeTruthy();
  await page.goto('/connections');
  await page.getByRole('button', { name: /Sent Requests/ }).click();
  const pending = page.locator('.connection-card').filter({ hasText: student!.name });
  const beforeCancel = reads.length;
  await pending.getByRole('button', { name: 'Cancel Request', exact: true }).click();
  await expect(pending).toHaveCount(0);
  expect(reads).toHaveLength(beforeCancel);
});
