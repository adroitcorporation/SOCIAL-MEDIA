import type { Tx } from '@/backend/types/database';
import { db } from '@/backend/database/client';

export const markNotificationsRead = (userId: string, id?: string) =>
  db.notification.updateMany({
    where: { userId, ...(id ? { id } : {}), readAt: null },
    data: { readAt: new Date() },
  });

export const notify = (tx: Tx, userId: string, title: string, body: string, href: string) =>
  tx.notification.create({ data: { userId, title, body, href } });
