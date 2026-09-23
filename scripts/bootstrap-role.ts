import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const id = process.argv[2];
  if (!id) throw new Error('Usage: npm run roles:bootstrap -- <existing-user-id>');
  await db.$transaction(
    async (tx) => {
      if (await tx.user.count({ where: { role: 'ULTIMATE_MODERATOR', accountStatus: 'ACTIVE' } }))
        throw new Error('An active Ultimate Moderator already exists. Use in-app role management.');
      const user = await tx.user.findUniqueOrThrow({ where: { id } });
      if (user.accountStatus !== 'ACTIVE') throw new Error('The bootstrap account must be active.');
      await tx.user.update({ where: { id }, data: { role: 'ULTIMATE_MODERATOR' } });
      await tx.moderationAction.create({
        data: {
          actorId: id,
          targetId: id,
          action: 'ULTIMATE_MODERATOR_BOOTSTRAPPED',
          reason: 'Trusted database operator bootstrap.',
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  console.log('Ultimate Moderator assigned. Sign in and open /moderation.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
