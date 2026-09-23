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

export const isModerator = (userId: string) =>
  (process.env.MODERATOR_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);

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
    const user = await tx.user.findUnique({ where: { id: userId } });
    requireThat(user, 404, 'Student not found.');
    requireThat(!user.collegeVerified, 409, 'Your college verification is already approved.');
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
  requireThat(isModerator(actor), 403, 'Moderator access required.');
  return db.collegeVerificationRequest.findMany({
    where: { status: 'PENDING' },
    select: { ...summary, user: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}

export async function verificationDocument(actor: string, id: string) {
  requireThat(isModerator(actor), 403, 'Moderator access required.');
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
  requireThat(isModerator(actor), 403, 'Moderator access required.');
  const data = verificationReviewSchema.parse(input);
  return transaction(async (tx) => {
    const request = await tx.collegeVerificationRequest.findUnique({
      where: { id },
      select: summary,
    });
    requireThat(request, 404, 'Verification request not found.');
    requireThat(request.status === 'PENDING', 409, 'This verification request is already decided.');
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
      data: { collegeVerified: data.status === 'APPROVED' },
    });
    return tx.collegeVerificationRequest.findUniqueOrThrow({ where: { id }, select: summary });
  });
}
