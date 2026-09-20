import { db } from '@/backend/database/client';
export async function saveEvent(userId: string, eventId: string, saved: unknown) {
  const key = { eventId, userId };
  return saved === true
    ? db.savedEvent.upsert({ where: { userId_eventId: key }, create: key, update: {} })
    : db.savedEvent.deleteMany({ where: key });
}
