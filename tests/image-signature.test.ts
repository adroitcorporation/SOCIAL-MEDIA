import { expect, it, vi } from 'vitest';
const parser = vi.hoisted(() => vi.fn());
vi.mock('sharp', () => ({ default: parser }));
import { decodeVerificationImage } from '@/backend/services/verification-image';
import { addEventAttachment } from '@/backend/services/event-attachments';

it.each(['image/png', 'image/jpeg', 'image/webp'])(
  'rejects SVG disguised as %s before invoking the native parser on either upload path',
  async (mime) => {
    const bytes = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>',
    );
    await expect(
      decodeVerificationImage(`data:${mime};base64,${bytes.toString('base64')}`),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      addEventAttachment('actor', 'event', { bytes, name: 'photo', mimeType: mime }),
    ).rejects.toMatchObject({ status: 400 });
    expect(parser).not.toHaveBeenCalled();
  },
);
