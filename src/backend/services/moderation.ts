import 'server-only';
import { z } from 'zod';
import { db } from '@/backend/database/client';
import { transaction } from '@/backend/database/transaction';
import { requireThat } from '@/backend/utils/errors';
import { requireActiveActor, requirePermission } from './permissions';
import {
  canAssignRole,
  canBanUser,
  canManageReports,
  canSeeReports,
  canViewModerationDashboard,
  reportStatuses,
  accountStatuses,
} from '@/shared/contracts/permissions';
import {
  accountSchema,
  roleSchema,
  reportSchema,
  reportReviewSchema,
} from '@/shared/contracts/moderation';

const person = {
  id: true,
  name: true,
  role: true,
  accountStatus: true,
  collegeVerified: true,
} as const;
const reportInclude = {
  target: { select: person },
  reporter: { select: { id: true, name: true } },
} as const;
const offset = (query: URLSearchParams) =>
  z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(query.get('page') || 0) * 100;
export async function submitReport(actor: string, input: unknown) {
  const data = reportSchema.parse(input);
  return transaction(async (tx) => {
    await requireActiveActor(actor, tx);
    requireThat(actor !== data.targetId, 400, 'You cannot report yourself.');
    requireThat(await tx.user.findUnique({ where: { id: data.targetId } }), 404, 'User not found.');
    requireThat(
      !(await tx.report.findFirst({
        where: {
          reporterId: actor,
          targetId: data.targetId,
          status: { in: ['OPEN', 'ESCALATED', 'REVIEWED'] },
        },
      })),
      409,
      'You already have an open report for this user.',
    );
    const report = await tx.report.create({ data: { ...data, reporterId: actor } });
    return { id: report.id };
  });
}
export async function listReports(actor: string, query: URLSearchParams) {
  await requirePermission(actor, canSeeReports);
  const status = query.get('status');
  const search = (query.get('search') || '').slice(0, 100);
  return db.report.findMany({
    where: {
      ...(status ? { status: z.enum(reportStatuses).parse(status) } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              { target: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: reportInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: offset(query),
    take: 100,
  });
}
export async function reviewReport(actor: string, id: string, input: unknown) {
  const data = reportReviewSchema.parse(input);
  return transaction(async (tx) => {
    await requirePermission(actor, canManageReports, tx);
    requireThat(await tx.report.findUnique({ where: { id } }), 404, 'Report not found.');
    const report = await tx.report.update({
      where: { id },
      data: { ...data, reviewerId: actor, reviewedAt: new Date() },
      include: reportInclude,
    });
    await tx.moderationAction.create({
      data: {
        actorId: actor,
        action: `REPORT_${data.status}`,
        targetId: id,
        reason: data.reviewNote,
      },
    });
    return report;
  });
}
export async function listModerationUsers(
  actor: string,
  query: URLSearchParams,
  rolesOnly = false,
) {
  await requirePermission(actor, rolesOnly ? (user) => canAssignRole(user, 'STUDENT') : canBanUser);
  const search = (query.get('search') || '').slice(0, 100);
  const status = query.get('status');
  return db.user.findMany({
    where: {
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { id: search }] }
        : {}),
      ...(status ? { accountStatus: z.enum(accountStatuses).parse(status) } : {}),
    },
    select: person,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: offset(query),
    take: 100,
  });
}
export async function changeUser(
  actor: string,
  id: string,
  input: unknown,
  kind: 'role' | 'status',
) {
  const data = kind === 'role' ? roleSchema.parse(input) : accountSchema.parse(input);
  return transaction(async (tx) => {
    const user = await requirePermission(
      actor,
      kind === 'role' ? (user) => canAssignRole(user, 'STUDENT') : canBanUser,
      tx,
    );
    const target = await tx.user.findUnique({ where: { id } });
    requireThat(target, 404, 'User not found.');
    // Moderators cannot disable the administrators who govern their access.
    requireThat(
      user.role === 'ULTIMATE_MODERATOR' || target.role !== 'ULTIMATE_MODERATOR',
      403,
      'Only an Ultimate Moderator can change this account.',
    );
    const removesUltimate =
      ('role' in data && data.role !== 'ULTIMATE_MODERATOR') ||
      ('accountStatus' in data && data.accountStatus !== 'ACTIVE');
    if (
      target.role === 'ULTIMATE_MODERATOR' &&
      target.accountStatus === 'ACTIVE' &&
      removesUltimate
    ) {
      const remaining = await tx.user.count({
        where: { role: 'ULTIMATE_MODERATOR', accountStatus: 'ACTIVE', id: { not: id } },
      });
      requireThat(remaining > 0, 409, 'Keep at least one active Ultimate Moderator.');
    }
    const { reason, ...change } = data;
    const updated = await tx.user.update({ where: { id }, data: change, select: person });
    await tx.moderationAction.create({
      data: {
        actorId: actor,
        targetId: id,
        action:
          kind === 'role'
            ? `ROLE_${target.role}_TO_${updated.role}`
            : `ACCOUNT_${target.accountStatus}_TO_${updated.accountStatus}`,
        reason,
      },
    });
    return updated;
  });
}
export async function dashboard(actor: string) {
  await requirePermission(actor, canViewModerationDashboard);
  const [
    activeUsers,
    totalEvents,
    verifiedUsers,
    unverifiedUsers,
    totalReports,
    flagged,
    suspendedUsers,
    bannedUsers,
    restrictedUsers,
    deactivatedUsers,
    recentEvents,
    recentReports,
    recentVerifications,
    activity,
    summary,
  ] = await Promise.all([
    db.user.count({ where: { accountStatus: 'ACTIVE' } }),
    db.event.count(),
    db.user.count({ where: { collegeVerified: true } }),
    db.user.count({ where: { collegeVerified: false } }),
    db.report.count(),
    db.report.findMany({
      where: { status: { in: ['OPEN', 'REVIEWED', 'ESCALATED'] } },
      distinct: ['targetId'],
      select: { targetId: true },
    }),
    db.user.count({ where: { accountStatus: 'SUSPENDED' } }),
    db.user.count({ where: { accountStatus: 'BANNED' } }),
    db.user.count({ where: { accountStatus: 'RESTRICTED' } }),
    db.user.count({ where: { accountStatus: 'DEACTIVATED' } }),
    db.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, organizer: true, createdAt: true },
    }),
    db.report.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: reportInclude }),
    db.collegeVerificationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    db.moderationAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { name: true } } },
    }),
    db.moderationAction.groupBy({ by: ['action'], _count: { _all: true } }),
  ] as const);
  return {
    metrics: {
      activeUsers,
      totalEvents,
      verifiedUsers,
      unverifiedUsers,
      totalReports,
      flaggedUsers: flagged.length,
      suspendedUsers,
      bannedUsers,
      restrictedUsers,
      deactivatedUsers,
    },
    recentEvents,
    recentReports,
    recentVerifications,
    activity,
    activitySummary: summary.map((item) => ({ action: item.action, count: item._count._all })),
  };
}
