import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { profileSchemaForExisting } from '@/shared/contracts/schemas';
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

export const saveProfile = async (actor: string, input: unknown) => {
  const current=await requireActiveActor(actor);
  return db.user.update({
    where: { id: actor },
    data: { ...profileSchemaForExisting(current).parse(input), onboarded: true },
  });
};
