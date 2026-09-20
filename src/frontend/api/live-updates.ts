import type { CommunityClient } from './community-client';
export function subscribeToLiveUpdates(api: CommunityClient, refresh: () => Promise<void>) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  let lastTick = 0;
  const connect = async () => {
    try {
      const response = await api.live(controller.signal);
      if (!response.ok || !response.body) throw new Error('Live connection unavailable');
      const reader = response.body.getReader();
      while (!controller.signal.aborted) {
        const { done } = await reader.read();
        if (done) break;
        if (document.visibilityState === 'visible' && Date.now() - lastTick > 2000) {
          lastTick = Date.now();
          await refresh();
          window.dispatchEvent(new Event('circle-refresh'));
        }
      }
    } catch {
      /* Reconnect with refreshed credentials, matching the current live-update behavior. */
    }
    if (!controller.signal.aborted) timeout = setTimeout(connect, 3000);
  };
  void connect();
  const focus = () => {
    refresh().catch(() => {});
    window.dispatchEvent(new Event('circle-refresh'));
  };
  window.addEventListener('focus', focus);
  return () => {
    controller.abort();
    clearTimeout(timeout);
    window.removeEventListener('focus', focus);
  };
}
