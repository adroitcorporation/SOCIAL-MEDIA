import { db } from '@/backend/database/client';
export const clearSkips = (userId: string) => db.skip.deleteMany({ where: { userId } });
export const skipStudent = (userId: string, targetId: string) =>
  db.skip.upsert({
    where: { userId_targetId: { userId, targetId } },
    create: { userId, targetId },
    update: {},
  });
