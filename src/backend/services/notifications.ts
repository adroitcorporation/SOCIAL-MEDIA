import type { Tx } from '@/backend/types/database';
import { transaction } from '@/backend/database/transaction';
import { requireActiveActor } from './permissions';

async function readSnapshot(userId: string, tx: Tx) {
  const [items, unreadCount] = await Promise.all([
    tx.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }),
    tx.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}
export const markNotificationsRead = (userId: string, id?: string) =>
  transaction(async (tx) => {
    await requireActiveActor(userId, tx);
    const changed = await tx.notification.updateMany({
      where: { userId, ...(id ? { id } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    return { count: changed.count, ...(await readSnapshot(userId, tx)) };
  });

export const notify = (tx: Tx, userId: string, title: string, body: string, href: string) =>
  tx.notification.create({ data: { userId, title, body, href } });

export const notificationSnapshot = (userId: string) =>
  transaction(async (tx) => {
    await requireActiveActor(userId, tx);
    return readSnapshot(userId, tx);
  });
