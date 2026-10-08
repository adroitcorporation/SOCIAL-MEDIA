import 'server-only';
import { migrationMaintenance, maintenanceResponse } from '@/backend/utils/maintenance';
import { authenticate } from '@/backend/auth/session';
import { notificationSnapshot } from '@/backend/services/notifications';
import { enforceLiveRateLimit } from './middleware';
import { errorResponse } from './error-response';

export async function handleLiveRequest(request: Request) {
  if (migrationMaintenance()) return maintenanceResponse();
  let userId: string;
  try {
    userId = (await authenticate(request)).id;
    await enforceLiveRateLimit(userId);
  } catch (error) {
    return errorResponse(error);
  }
  let timer: ReturnType<typeof setInterval>;
  let closeTimer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let pending = false;
  let lastNotifications = '';
  let onAbort: (() => void) | undefined;
  const cleanup = () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(closeTimer);
    if (onAbort) request.signal.removeEventListener('abort', onAbort);
  };
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const close = () => {
        if (!stopped) {
          cleanup();
          controller.close();
        }
      };
      onAbort = close;
      request.signal.addEventListener('abort', close, { once: true });
      if (request.signal.aborted) {
        close();
        return;
      }
      controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
      const publishNotifications = async () => {
        if (stopped || pending) return;
        pending = true;
        try {
          // Reuses the existing cross-instance, three-second SSE invalidation cadence.
          // This scoped read rechecks account access and never reruns recommendations.
          const payload = JSON.stringify(await notificationSnapshot(userId));
          if (!stopped && payload !== lastNotifications) {
            lastNotifications = payload;
            controller.enqueue(encoder.encode(`event: notifications\ndata: ${payload}\n\n`));
          }
        } catch {
          // Close on lost access or a failed read; reconnect authenticates afresh.
          close();
        } finally {
          pending = false;
        }
      };
      void publishNotifications();
      timer = setInterval(() => {
        if (stopped) return;
        controller.enqueue(encoder.encode('event: refresh\ndata: {}\n\n'));
        void publishNotifications();
      }, 3000);
      closeTimer = setTimeout(close, 55000);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
