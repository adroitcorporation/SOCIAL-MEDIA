import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { profileSchemaForExisting } from '@/shared/contracts/schemas';
import { transaction } from '@/backend/database/transaction';
import { requireActiveActor } from './permissions';

export async function getStudent(actor: string, id: string) {
  requireThat(
    !(await db.block.findFirst({
      where: {
        OR: [
          { blockerId: actor, blockedId: id },
          { blockerId: id, blockedId: actor },
        ],
      },
    })),
    403,
    'Profile unavailable.',
  );
  const student = await db.user.findUnique({ where: { id } });
  requireThat(student, 404, 'Student not found.');
  return student;
}

export const saveProfile = (actor: string, input: unknown) =>
  transaction(async (tx) => {
    const current = await requireActiveActor(actor, tx);
    return tx.user.update({
      where: { id: actor },
      data: { ...profileSchemaForExisting(current).parse(input), onboarded: true },
    });
  });
