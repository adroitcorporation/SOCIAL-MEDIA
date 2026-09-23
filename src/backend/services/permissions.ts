import 'server-only';
import { db } from '@/backend/database/client';
import type { Tx } from '@/backend/types/database';
import { requireThat } from '@/backend/utils/errors';
import type { Principal } from '@/shared/contracts/permissions';

export async function requireActiveActor(id: string, client: Tx = db) {
  const user = await client.user.findUnique({ where: { id } });
  requireThat(user, 401, 'Please sign in to continue.');
  requireThat(
    user.accountStatus === 'ACTIVE',
    403,
    `Your account is ${user.accountStatus.toLowerCase()}. Contact the moderation team.`,
  );
  return user;
}
export async function requirePermission(
  id: string,
  permission: (user: Principal) => boolean,
  client: Tx = db,
) {
  const user = await requireActiveActor(id, client);
  requireThat(permission(user), 403, 'Your role does not permit this action.');
  return user;
}
