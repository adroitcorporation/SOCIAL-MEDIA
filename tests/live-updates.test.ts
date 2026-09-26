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
