import { requireThat } from '@/backend/utils/errors';
/** Enforce the byte limit while reading, not after buffering an arbitrarily large body. */
export async function boundedJson(request: Request, maxBytes = 20000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        requireThat(false, 413, 'Request is too large.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text || '{}');
  } finally {
    reader.releaseLock();
  }
}
