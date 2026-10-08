import { db } from '@/backend/database/client';
import { transaction } from '@/backend/database/transaction';
import { requirePermission, requireActiveActor } from './permissions';
import { canCreateEvent, canEditEvent, canDeleteEvent } from '@/shared/contracts/permissions';
import { eventSchema } from '@/shared/contracts/moderation';
import { requireThat } from '@/backend/utils/errors';
import { z } from 'zod';
import { listEventAttachments } from './event-attachments';
import { deleteEventAttachment } from './event-attachments';

export async function managedEvents(actor: string, query = new URLSearchParams()) {
  const user = await requirePermission(actor, canCreateEvent);
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(query.get('page') || 0);
  const search = (query.get('search') || '').slice(0, 100);
  const events = await db.event.findMany({
    where: {
      ...(user.role === 'ULTIMATE_MODERATOR' ? {} : { ownerId: actor }),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: page * 100,
    take: 100,
    include: { savedBy: { where: { userId: actor } } },
  });
  const attachments = await listEventAttachments(events.map((event) => event.id));
  return events.map((event) => ({
    ...event,
    attachments: attachments.get(event.id) ?? [],
  }));
}
export async function createEvent(actor: string, input: unknown) {
  const data = eventSchema.parse(input);
  return transaction(async (tx) => {
    await requirePermission(actor, canCreateEvent, tx);
    const event = await tx.event.create({
      data: { ...data, startsAt: new Date(data.startsAt), ownerId: actor },
    });
    await tx.moderationAction.create({
      data: { actorId: actor, action: 'EVENT_CREATED', targetId: event.id },
    });
    return event;
  });
}
export async function editEvent(actor: string, id: string, input: unknown) {
  const data = eventSchema.parse(input);
  return transaction(async (tx) => {
    const user = await requirePermission(actor, canCreateEvent, tx);
    const event = await tx.event.findUnique({ where: { id } });
    requireThat(event, 404, 'Event not found.');
    requireThat(canEditEvent(user, event), 403, 'You can only edit events you created.');
    const updated = await tx.event.update({
      where: { id },
      data: { ...data, startsAt: new Date(data.startsAt) },
    });
    await tx.moderationAction.create({
      data: { actorId: actor, action: 'EVENT_EDITED', targetId: id },
    });
    return updated;
  });
}
export async function deleteEvent(actor: string, id: string) {
  // Delete private objects through the authorized, retryable attachment path before cascade.
  const principal = await requirePermission(actor, canCreateEvent);
  const candidate = await db.event.findUnique({ where: { id } });
  requireThat(candidate, 404, 'Event not found.');
  requireThat(canDeleteEvent(principal, candidate), 403, 'You can only delete events you created.');
  const files = await db.eventAttachment.findMany({ where: { eventId: id }, select: { id: true } });
  for (const file of files) await deleteEventAttachment(actor, id, file.id);
  return transaction(async (tx) => {
    const user = await requirePermission(actor, canCreateEvent, tx);
    const event = await tx.event.findUnique({ where: { id } });
    requireThat(event, 404, 'Event not found.');
    requireThat(canDeleteEvent(user, event), 403, 'You can only delete events you created.');
    await tx.event.delete({ where: { id } });
    await tx.moderationAction.create({
      data: { actorId: actor, action: 'EVENT_DELETED', targetId: id },
    });
    return { ok: true };
  });
}
export async function saveEvent(userId: string, eventId: string, saved: unknown) {
  const enabled = z.boolean().parse(saved);
  return transaction(async (tx) => {
    await requireActiveActor(userId, tx);
    const key = { eventId, userId };
    return enabled
      ? tx.savedEvent.upsert({ where: { userId_eventId: key }, create: key, update: {} })
      : tx.savedEvent.deleteMany({ where: key });
  });
}
