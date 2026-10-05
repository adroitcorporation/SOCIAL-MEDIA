import { test as base, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

// Real connection flows require college verification. Change only the loopback
// fixture and restore it, rather than relying on a developer's existing seed state.
export const test = base.extend<{ verifiedDemo: void }>({
  verifiedDemo: [
    async ({ request }, use) => {
      expect((await (await request.get('/api/config')).json()).demo).toBe(true);
      const db = new PrismaClient({
        datasources: {
          db: {
            url: 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
          },
        },
      });
      const original = await db.user.findUniqueOrThrow({ where: { id: 'demo-aarav' } });
      try {
        await db.user.update({ where: { id: original.id }, data: { collegeVerified: true } });
        await use();
      } finally {
        await db.user.update({
          where: { id: original.id },
          data: { collegeVerified: original.collegeVerified },
        });
        await db.$disconnect();
      }
    },
    { auto: true },
  ],
});
