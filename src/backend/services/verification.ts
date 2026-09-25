import { requirePermission, requireActiveActor } from './permissions';
import { canApproveVerification } from '@/shared/contracts/permissions';
import type { Prisma } from '@prisma/client';
import { db } from '@/backend/database/client';
import { transaction } from '@/backend/database/transaction';
import { requireThat } from '@/backend/utils/errors';
import { verificationRequestSchema, verificationReviewSchema } from '@/shared/contracts/schemas';
import { decodeVerificationImage } from './verification-image';

const summary = {
  id: true,
  userId: true,
  method: true,
  collegeEmail: true,
  status: true,
  reviewNote: true,
  reviewerId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CollegeVerificationRequestSelect;

export async function latestVerification(userId: string) {
  return db.collegeVerificationRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: summary,
  });
}

export async function submitVerification(userId: string, input: unknown) {
  const data = verificationRequestSchema.parse(input);
  const document =
    data.method === 'COLLEGE_ID' ? await decodeVerificationImage(data.documentUrl!) : {};
  return transaction(async (tx) => {
    const user = await requireActiveActor(userId, tx);
    requireThat(user, 404, 'Student not found.');
    requireThat(
      !user.collegeVerified && !user.emailVerified,
      409,
      'Your college verification is already approved.',
    );
    const pending = await tx.collegeVerificationRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    requireThat(!pending, 409, 'You already have a verification under review.');
    return tx.collegeVerificationRequest.create({
      data: {
        userId,
        method: data.method,
        collegeEmail: data.method === 'EMAIL' ? data.collegeEmail : null,
        ...document,
      },
      select: summary,
    });
  });
}

export async function listVerificationRequests(actor: string) {
  await requirePermission(actor, canApproveVerification);
  return db.collegeVerificationRequest.findMany({
    where: { status: 'PENDING' },
    select: { ...summary, user: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}

export async function verificationDocument(actor: string, id: string) {
  await requirePermission(actor, canApproveVerification);
  const request = await db.collegeVerificationRequest.findUnique({
    where: { id },
    select: { documentBytes: true, documentMime: true, documentUrl: true },
  });
  requireThat(request, 404, 'Verification request not found.');
  if (request.documentBytes && request.documentMime)
    return { documentBytes: request.documentBytes, documentMime: request.documentMime };
  // Read legacy inline submissions privately; never fetch arbitrary remote URLs.
  if (request.documentUrl?.startsWith('data:')) return decodeVerificationImage(request.documentUrl);
  requireThat(false, 404, 'Image unavailable. Ask the student to submit again.');
}

export async function reviewVerification(actor: string, id: string, input: unknown) {
  await requirePermission(actor, canApproveVerification);
  const data = verificationReviewSchema.parse(input);
  return transaction(async (tx) => {
    await requirePermission(actor, canApproveVerification, tx);
    const request = await tx.collegeVerificationRequest.findUnique({
      where: { id },
      select: summary,
    });
    requireThat(request, 404, 'Verification request not found.');
    requireThat(request.status === 'PENDING', 409, 'This verification request is already decided.');
    const applicant = await tx.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { collegeVerified: true, emailVerified: true },
    });
    const changed = await tx.collegeVerificationRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: data.status,
        reviewNote: data.reviewNote,
        reviewerId: actor,
        reviewedAt: new Date(),
      },
    });
    requireThat(changed.count === 1, 409, 'This verification request is already decided.');
    await tx.user.update({
      where: { id: request.userId },
      data: {
        collegeVerified:
          applicant.collegeVerified || applicant.emailVerified || data.status === 'APPROVED',
      },
    });
    await tx.moderationAction.create({
      data: {
        actorId: actor,
        action: `VERIFICATION_${data.status}`,
        targetId: id,
        reason: data.reviewNote,
      },
    });
    return tx.collegeVerificationRequest.findUniqueOrThrow({ where: { id }, select: summary });
  });
}
