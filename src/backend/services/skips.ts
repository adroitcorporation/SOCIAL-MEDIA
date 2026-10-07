import { transaction } from '@/backend/database/transaction';
import { requireActiveActor } from './permissions';
export const clearSkips = (userId: string) =>
  transaction(async (tx) => {
    await requireActiveActor(userId, tx);
    return tx.skip.deleteMany({ where: { userId } });
  });
export const skipStudent = (userId: string, targetId: string) =>
  transaction(async (tx) => {
    await requireActiveActor(userId, tx);
    return tx.skip.upsert({
      where: { userId_targetId: { userId, targetId } },
      create: { userId, targetId },
      update: {},
    });
  });
