import { afterEach, expect, it, vi } from 'vitest';
import { handleLiveRequest } from '@/backend/http/live-handler';
import { AppError } from '@/backend/utils/errors';
const doubles = vi.hoisted(() => ({ authenticate: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/backend/http/middleware', () => ({ enforceLiveRateLimit: vi.fn() }));
vi.mock('@/backend/auth/session', () => ({ authenticate: doubles.authenticate }));
vi.mock('@/backend/services/notifications', () => ({ notificationSnapshot: doubles.snapshot }));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it('uses one stream, sends only changed scoped notification snapshots, and stops on lost access', async () => {
  vi.useFakeTimers();
  doubles.authenticate.mockResolvedValue({ id: 'me' });
  doubles.snapshot.mockResolvedValue({ items: [], unreadCount: 0 });
  const response = await handleLiveRequest(new Request('http://localhost/api/live'));
  const reader = response.body!.getReader();
  const decode = async () => new TextDecoder().decode((await reader.read()).value);
  expect(await decode()).toContain('event: ready');
  expect(await decode()).toContain('"unreadCount":0');
  expect(doubles.snapshot).toHaveBeenCalledWith('me');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await decode()).toBe('event: refresh\ndata: {}\n\n');
  doubles.snapshot.mockResolvedValue({ items: [{ id: 'new' }], unreadCount: 1 });
  await vi.advanceTimersByTimeAsync(3000);
  expect(await decode()).toContain('event: refresh');
  expect(await decode()).toContain('"unreadCount":1');
  doubles.snapshot.mockRejectedValue(new AppError(403, 'Inactive account'));
  await vi.advanceTimersByTimeAsync(3000);
  expect(await decode()).toContain('event: refresh');
  expect((await reader.read()).done).toBe(true);
  await vi.advanceTimersByTimeAsync(60000);
  expect(doubles.snapshot).toHaveBeenCalledTimes(4);
});

it('never opens a stream for an unauthenticated request', async () => {
  doubles.authenticate.mockRejectedValue(new AppError(401, 'No session'));
  expect((await handleLiveRequest(new Request('http://localhost/api/live'))).status).toBe(401);
  expect(doubles.snapshot).not.toHaveBeenCalled();
});
