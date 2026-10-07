import { afterEach, expect, it, vi } from 'vitest';
import { subscribeToLiveUpdates } from '@/frontend/api/live-updates';
import type { CommunityClient } from '@/frontend/api/community-client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('ignores ready frames, parses split events, throttles snapshots, and cleans up', async () => {
  vi.useFakeTimers();
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const tick = vi.fn();
  win.addEventListener('circle-refresh', tick);
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller;
    },
  });
  const live = vi.fn(async (signal: AbortSignal) => {
    signal.addEventListener('abort', () => stream.close(), { once: true });
    return new Response(body);
  });
  const refresh = vi.fn(async () => {});
  const stop = subscribeToLiveUpdates({ live } as unknown as CommunityClient, refresh);
  const emit = async (text: string) => {
    stream.enqueue(new TextEncoder().encode(text));
    await vi.advanceTimersByTimeAsync(0);
  };
  await emit('event: ready\ndata: {}\n\n');
  expect(refresh).not.toHaveBeenCalled();
  expect(tick).not.toHaveBeenCalled();
  await emit('event: ref');
  expect(tick).not.toHaveBeenCalled();
  await emit('resh\ndata: {}\n\n');
  expect(tick).toHaveBeenCalledOnce();
  expect(refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15000);
  await emit('event: refresh\ndata: {}\n\n');
  expect(refresh).toHaveBeenCalledOnce();
  doc.visibilityState = 'hidden';
  await vi.advanceTimersByTimeAsync(15000);
  await emit('event: refresh\ndata: {}\n\n');
  expect(refresh).toHaveBeenCalledOnce();
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(2);
  stop();
  win.dispatchEvent(new Event('focus'));
  doc.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(60000);
  expect(live).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('delivers notification payloads independently of snapshot throttling and accepts split CRLF frames', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller;
    },
  });
  const refresh = vi.fn(async () => {});
  const receive = vi.fn();
  const live = vi.fn(async (signal: AbortSignal) => {
    signal.addEventListener('abort', () => stream.close(), { once: true });
    return new Response(body);
  });
  const stop = subscribeToLiveUpdates({ live } as unknown as CommunityClient, refresh, receive);
  const payload = {
    items: [
      {
        id: 'n1',
        userId: 'me',
        title: 'Request',
        body: 'Connect',
        href: '/connections',
        readAt: null,
        createdAt: '2026-10-07',
      },
    ],
    unreadCount: 101,
  };
  stream.enqueue(new TextEncoder().encode('event: notifications\r'));
  await vi.advanceTimersByTimeAsync(0);
  stream.enqueue(new TextEncoder().encode(`\ndata: ${JSON.stringify(payload)}\r\n\r\n`));
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledWith(payload);
  expect(refresh).not.toHaveBeenCalled();
  stream.enqueue(
    new TextEncoder().encode(
      'event: notifications\ndata: invalid\n\nevent: notifications\ndata: {"items":[],"unreadCount":-1}\n\n',
    ),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledOnce();
  stop();
  await vi.advanceTimersByTimeAsync(60000);
  expect(live).toHaveBeenCalledOnce();
});
