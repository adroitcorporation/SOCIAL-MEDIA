import { authenticate } from '@/lib/auth';
import { AppError } from '@/lib/errors';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await authenticate(request);
  } catch (error) {
    return Response.json(
      { error: 'Please sign in.' },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
  let timer: ReturnType<typeof setInterval>;
  let closeTimer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const cleanup = () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(closeTimer);
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
      request.signal.addEventListener('abort', close, { once: true });
      controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
      // Stateless invalidations work across Render instances. Every subsequent data read
      // revalidates auth and membership; removed users never receive private payloads here.
      timer = setInterval(() => {
        if (!stopped) controller.enqueue(encoder.encode('event: refresh\ndata: {}\n\n'));
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
