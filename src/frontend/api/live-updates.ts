import type { NotificationSnapshot } from '@/shared/contracts/responses';
import type { CommunityClient } from './community-client';
export function subscribeToLiveUpdates(
  api: CommunityClient,
  refresh: () => Promise<void>,
  onNotifications?: (snapshot: NotificationSnapshot) => void,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  let lastRefresh = Date.now();
  let pending: Promise<void> | undefined;
  const update = (force = false) => {
    if (controller.signal.aborted || document.visibilityState !== 'visible') return;
    // Chat consumes incremental ticks independently of the app snapshot.
    window.dispatchEvent(new Event('circle-refresh'));
    if (!pending && (force || Date.now() - lastRefresh >= 15000)) {
      lastRefresh = Date.now();
      pending = refresh()
        .catch(() => {})
        .finally(() => {
          pending = undefined;
        });
    }
  };
  const connect = async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await api.live(controller.signal);
      if (!response.ok || !response.body) throw new Error('Live connection unavailable');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;
        buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const lines = frame.split('\n').map((line) => line.trimEnd());
          if (lines.some((line) => line === 'event: refresh')) update();
          if (lines.some((line) => line === 'event: notifications')) {
            try {
              const payload = JSON.parse(
                lines
                  .filter((line) => line.startsWith('data:'))
                  .map((line) => line.slice(5).trimStart())
                  .join('\n'),
              );
              if (
                Array.isArray(payload.items) &&
                Number.isInteger(payload.unreadCount) &&
                payload.unreadCount >= 0 &&
                payload.items.every(
                  (item: Record<string, unknown>) =>
                    item &&
                    typeof item.id === 'string' &&
                    typeof item.userId === 'string' &&
                    typeof item.title === 'string' &&
                    typeof item.body === 'string' &&
                    typeof item.href === 'string' &&
                    typeof item.createdAt === 'string' &&
                    (item.readAt === null || typeof item.readAt === 'string'),
                )
              )
                onNotifications?.(payload);
            } catch {
              /* Ignore malformed frames without tearing down the shared connection. */
            }
          }
        }
      }
    } catch {
      // Reconnect with fresh credentials; every data request checks authorization.
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
    if (!controller.signal.aborted) timeout = setTimeout(connect, 3000);
  };
  void connect();
  const focus = () => update(true);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', focus);
  return () => {
    controller.abort();
    clearTimeout(timeout);
    window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', focus);
  };
}
