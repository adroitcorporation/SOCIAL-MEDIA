import { z } from 'zod';
import { accountStatuses, reportStatuses, userRoles } from './permissions';
import type { AccountStatus, ReportStatus, UserRole } from './permissions';
export const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(60),
  organizer: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime({ offset: true }),
  url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith('https://'), 'Use an HTTPS event link.'),
});
export type EventInput = z.infer<typeof eventSchema>;
export const reportSchema = z.object({
  targetId: z.string().min(1).max(100),
  reason: z.string().trim().min(10).max(2000),
});
export const reportReviewSchema = z.object({
  status: z.enum(reportStatuses).exclude(['OPEN']),
  reviewNote: z.string().trim().min(1).max(1000),
});
export const accountSchema = z.object({
  accountStatus: z.enum(accountStatuses),
  reason: z.string().trim().min(1).max(1000),
});
export const roleSchema = z.object({
  role: z.enum(userRoles),
  reason: z.string().trim().min(1).max(1000),
});
export interface ModerationUser {
  id: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
  collegeVerified: boolean;
}
export interface ReportItem {
  id: string;
  targetId: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  reviewNote: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  target: ModerationUser;
  reporter: { id: string; name: string };
}
export interface Dashboard {
  metrics: {
    activeUsers: number;
    totalEvents: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    totalReports: number;
    flaggedUsers: number;
    suspendedUsers: number;
    bannedUsers: number;
    restrictedUsers: number;
    deactivatedUsers: number;
  };
  recentEvents: { id: string; title: string; organizer: string; createdAt: string }[];
  recentReports: ReportItem[];
  recentVerifications: { id: string; status: string; createdAt: string; user: { name: string } }[];
  activity: {
    id: string;
    actor: { name: string };
    action: string;
    targetId: string;
    reason: string;
    createdAt: string;
  }[];
  activitySummary: { action: string; count: number }[];
}
