import { db } from '@/backend/database/client';
import { requireThat } from '@/backend/utils/errors';
import { profileSchema } from '@/shared/contracts/schemas';

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
  db.user.update({
    where: { id: actor },
    data: { ...profileSchema.parse(input), onboarded: true },
  });
