import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  fetcher.mockReset().mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('reuses a successful bridge sync across screen remounts with the same token', async () => {
  const { syncPageSession } = await import('@/frontend/api/page-session');
  await syncPageSession('same-token');
  await syncPageSession('same-token');
  expect(fetcher).toHaveBeenCalledOnce();
});

it('coalesces concurrent syncs but synchronizes a changed token', async () => {
  const { syncPageSession } = await import('@/frontend/api/page-session');
  await Promise.all([syncPageSession('first-token'), syncPageSession('first-token')]);
  expect(fetcher).toHaveBeenCalledOnce();
  await syncPageSession('refreshed-token');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not cache a failed sync', async () => {
  const { syncPageSession } = await import('@/frontend/api/page-session');
  fetcher.mockResolvedValueOnce(Response.json({ error: 'Unavailable' }, { status: 503 }));
  await expect(syncPageSession('token')).rejects.toThrow('Your session is unavailable');
  await syncPageSession('token');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('expires the successful-sync marker so future mounts can repair the cookie', async () => {
  vi.useFakeTimers();
  const { syncPageSession } = await import('@/frontend/api/page-session');
  await syncPageSession('token');
  await vi.advanceTimersByTimeAsync(60001);
  await syncPageSession('token');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('clears after pending writes and invalidates the successful-sync marker on logout', async () => {
  const { syncPageSession, clearPageSession } = await import('@/frontend/api/page-session');
  let complete!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const syncing = syncPageSession('token');
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  const clearing = clearPageSession();
  expect(fetcher).toHaveBeenCalledOnce();
  complete(Response.json({ ok: true }));
  await Promise.all([syncing, clearing]);
  await syncPageSession('token');
  expect(fetcher.mock.calls.map(([, options]) => options?.method)).toEqual([
    'POST',
    'DELETE',
    'POST',
  ]);
});
