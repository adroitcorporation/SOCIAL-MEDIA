import type { Prisma } from '@prisma/client';

// Chat renders identity only. Full profiles are still loaded for profile cards.
export const chatIdentity = { id: true, name: true, photo: true } satisfies Prisma.UserSelect;

export const visibleTo = (actor: string): Prisma.UserWhereInput => ({
  blocks: { none: { blockedId: actor } },
  blockedBy: { none: { blockerId: actor } },
});
