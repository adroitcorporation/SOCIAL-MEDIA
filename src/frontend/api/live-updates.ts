import type { CommunityClient } from './community-client';
export function subscribeToLiveUpdates(api: CommunityClient, refresh: () => Promise<void>) {
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
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (frame.split('\n').some((line) => line.trim() === 'event: refresh')) update();
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
