import { describe, expect, it, vi } from 'vitest';
import { ApiError, createHttpClient } from '@/frontend/api/http-client';
import { createCommunityClient } from '@/frontend/api/community-client';
import { serialize } from '@/backend/http/serialization';

describe('frontend/backend transport contract', () => {
  it('uses the configured base URL, encodes IDs, and sends authenticated JSON mutations', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
    const api = createCommunityClient(
      createHttpClient({
        baseUrl: 'https://example.test/api/',
        getAccessToken: async () => 'token',
        fetch: fetcher,
      }),
    );
    await api.ideas.resonate('idea/one', { enabled: true });
    expect(fetcher).toHaveBeenCalledWith('https://example.test/api/ideas/idea%2Fone/resonate', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: '{"enabled":true}',
      cache: 'no-store',
    });
  });
  it('keeps reads body-free and passes query parameters through', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ students: [] }));
    const api = createCommunityClient(createHttpClient({ fetch: fetcher }));
    expect(await api.state('city=Pune&page=2')).toEqual({ students: [] });
    expect(fetcher).toHaveBeenCalledWith('/api/state?city=Pune&page=2', {
      method: 'GET',
      headers: {},
      body: undefined,
      cache: 'no-store',
    });
  });
  it('preserves PATCH and DELETE requests, including an empty JSON body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ count: 1 }));
    const api = createCommunityClient(createHttpClient({ fetch: fetcher }));
    await api.notifications.markRead('n1');
    await api.blocks.remove('u1');
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ['/api/notifications/n1', 'PATCH', '{}'],
      ['/api/blocks/u1', 'DELETE', '{}'],
    ]);
  });
  it('preserves error status and message and invalidates a rejected session', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error: 'Sign in again.' }, { status: 401 }));
    const client = createHttpClient({ fetch: fetcher, onUnauthorized });
    await expect(client.request('state')).rejects.toMatchObject({
      status: 401,
      message: 'Sign in again.',
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(new ApiError(403, 'Forbidden')).toBeInstanceOf(Error);
  });
  it('authenticates live streams and passes their cancellation signal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('data: tick\n\n'));
    const api = createCommunityClient(
      createHttpClient({ fetch: fetcher, getAccessToken: async () => 'token' }),
    );
    const controller = new AbortController();
    await api.live(controller.signal);
    expect(fetcher).toHaveBeenCalledWith('/api/live', {
      headers: { Authorization: 'Bearer token' },
      signal: controller.signal,
    });
  });
  it('serializes nested database dates exactly as existing JSON responses do', () => {
    const date = new Date('2026-09-20T12:00:00.000Z');
    const value = { createdAt: date, messages: [{ createdAt: date, readAt: null }] };
    expect(serialize(value)).toEqual({
      createdAt: date.toISOString(),
      messages: [{ createdAt: date.toISOString(), readAt: null }],
    });
  });
});
