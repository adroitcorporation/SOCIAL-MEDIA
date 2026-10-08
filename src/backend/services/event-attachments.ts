import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { db } from '@/backend/database/client';
import { transaction } from '@/backend/database/transaction';
import { canCreateEvent, canEditEvent } from '@/shared/contracts/permissions';
import {
  EVENT_ATTACHMENT_MAX_BYTES,
  EVENT_ATTACHMENT_MAX_FILES,
  EVENT_ATTACHMENT_MAX_TOTAL_BYTES,
  EVENT_ATTACHMENT_TYPES,
} from '@/shared/contracts/event-attachments';
import { AppError, requireThat } from '@/backend/utils/errors';
import { requireImageSignature } from '@/backend/utils/image-signature';
import { requirePermission } from './permissions';
import {
  privateFilesUseStorage,
  storePrivateFile,
  readPrivateFile,
  removePrivateFile,
} from './file-storage';

type EventAttachmentMetadata = {
  id: string;
  eventId: string;
  name: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
};

export async function listEventAttachments(eventIds: string[]) {
  const byEvent = new Map<string, Omit<EventAttachmentMetadata, 'eventId'>[]>();
  if (!eventIds.length) return byEvent;
  const attachments = await db.$queryRaw<EventAttachmentMetadata[]>(Prisma.sql`
    SELECT id, "eventId", name, "mimeType", size
    FROM "EventAttachment"
    WHERE "eventId" IN (${Prisma.join(eventIds)}) AND "deletedAt" IS NULL
    ORDER BY "createdAt" ASC, id ASC
  `);
  for (const { eventId, ...attachment } of attachments) {
    const current = byEvent.get(eventId) ?? [];
    current.push(attachment);
    byEvent.set(eventId, current);
  }
  return byEvent;
}

function cleanName(input: string) {
  const name = input
    .replace(/[/\\]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 160);
  requireThat(name.length > 0, 400, 'Attachment filename is required.');
  return name;
}

async function validateFile(mimeType: string, input: Uint8Array) {
  requireThat(
    EVENT_ATTACHMENT_TYPES.some((type) => type === mimeType),
    415,
    'Choose a PDF, JPG, PNG, or WebP file.',
  );
  requireThat(
    input.length > 0 && input.length <= EVENT_ATTACHMENT_MAX_BYTES,
    413,
    'Attachment must be at most 8 MB.',
  );
  if (mimeType === 'application/pdf') {
    requireThat(
      input.length >= 8 && new TextDecoder().decode(input.slice(0, 5)) === '%PDF-',
      400,
      'The selected file is not a valid PDF.',
    );
    return input;
  }

  requireImageSignature(input, mimeType);
  const formats = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    const actualType = formats[metadata.format as keyof typeof formats];
    requireThat(
      actualType === mimeType && (metadata.pages ?? 1) === 1,
      400,
      'Choose a valid, non-animated JPG, PNG, or WebP image.',
    );
    const bytes = await image.rotate().toBuffer();
    requireThat(bytes.length <= EVENT_ATTACHMENT_MAX_BYTES, 413, 'Image must be at most 8 MB.');
    return bytes;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'The selected image is invalid or unsupported.');
  }
}

export async function addEventAttachment(
  actor: string,
  eventId: string,
  input: { name: string; mimeType: string; bytes: Uint8Array },
) {
  const name = cleanName(input.name);
  const bytes = await validateFile(input.mimeType, input.bytes);
  const attachmentId = randomUUID();
  const storagePath = privateFilesUseStorage() ? `${actor}/${attachmentId}` : null;
  if (storagePath) {
    const user = await requirePermission(actor, canCreateEvent);
    const event = await db.event.findUnique({ where: { id: eventId } });
    requireThat(event, 404, 'Event not found.');
    requireThat(canEditEvent(user, event), 403, 'You can only attach files to events you created.');
    await storePrivateFile('event-attachments', storagePath, bytes, input.mimeType);
  }
  try {
    return await transaction(async (tx) => {
      const user = await requirePermission(actor, canCreateEvent, tx);
      const event = await tx.event.findUnique({ where: { id: eventId } });
      requireThat(event, 404, 'Event not found.');
      requireThat(
        canEditEvent(user, event),
        403,
        'You can only attach files to events you created.',
      );
      const [{ count, totalBytes }] = await tx.$queryRaw<{ count: number; totalBytes: number }[]>`
      SELECT count(*)::int AS count, coalesce(sum(size), 0)::int AS "totalBytes"
      FROM "EventAttachment" WHERE "eventId" = ${eventId} AND "deletedAt" IS NULL
    `;
      requireThat(
        count < EVENT_ATTACHMENT_MAX_FILES,
        409,
        `An event can have at most ${EVENT_ATTACHMENT_MAX_FILES} attachments.`,
      );
      requireThat(
        totalBytes + bytes.length <= EVENT_ATTACHMENT_MAX_TOTAL_BYTES,
        413,
        'Event attachments can total at most 20 MB.',
      );
      const [attachment] = await tx.$queryRaw<
        Pick<EventAttachmentMetadata, 'id' | 'name' | 'mimeType' | 'size'>[]
      >`
      INSERT INTO "EventAttachment" (id, "eventId", "ownerId", name, "mimeType", size, bytes, "storagePath")
      VALUES (${attachmentId}, ${eventId}, ${actor}, ${name}, ${input.mimeType}, ${bytes.length}, ${storagePath ? new Uint8Array() : bytes}, ${storagePath})
      RETURNING id, name, "mimeType", size
    `;
      await tx.moderationAction.create({
        data: { actorId: actor, action: 'EVENT_ATTACHMENT_ADDED', targetId: eventId },
      });
      return attachment;
    });
  } catch (error) {
    if (storagePath)
      await removePrivateFile('event-attachments', storagePath).catch(() => {
        console.error('Private attachment upload cleanup failed; Storage reconciliation required.');
      });
    throw error;
  }
}

export async function deleteEventAttachment(actor: string, eventId: string, attachmentId: string) {
  const deleted = await transaction(async (tx) => {
    const user = await requirePermission(actor, canCreateEvent, tx);
    const event = await tx.event.findUnique({ where: { id: eventId } });
    requireThat(event, 404, 'Event not found.');
    requireThat(canEditEvent(user, event), 403, 'You can only edit events you created.');
    const [attachment] = await tx.$queryRaw<{ id: string; storagePath: string | null }[]>`
      SELECT id, "storagePath" FROM "EventAttachment" WHERE id = ${attachmentId} AND "eventId" = ${eventId}
    `;
    requireThat(attachment, 404, 'Event attachment not found.');
    // Retain a retryable reference until provider deletion succeeds; reads hide the tombstone.
    await tx.$executeRaw`UPDATE "EventAttachment" SET "deletedAt" = CURRENT_TIMESTAMP
      WHERE id = ${attachmentId} AND "eventId" = ${eventId}`;
    await tx.moderationAction.create({
      data: { actorId: actor, action: 'EVENT_ATTACHMENT_DELETED', targetId: eventId },
    });
    return attachment;
  });
  if (deleted.storagePath) await removePrivateFile('event-attachments', deleted.storagePath);
  await db.$executeRaw`DELETE FROM "EventAttachment" WHERE id = ${attachmentId} AND "eventId" = ${eventId} AND "deletedAt" IS NOT NULL`;
  return { ok: true };
}

export async function getEventAttachment(eventId: string, attachmentId: string) {
  const [attachment] = await db.$queryRaw<
    { name: string; mimeType: string; bytes: Uint8Array; storagePath: string | null }[]
  >`
    SELECT name, "mimeType", bytes, "storagePath" FROM "EventAttachment"
    WHERE "eventId" = ${eventId} AND id = ${attachmentId} AND "deletedAt" IS NULL
  `;
  requireThat(attachment, 404, 'Event attachment not found.');
  if (attachment.storagePath)
    attachment.bytes = await readPrivateFile('event-attachments', attachment.storagePath);
  return attachment;
}
