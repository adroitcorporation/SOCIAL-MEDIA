export const userRoles = ['STUDENT', 'ORGANISER', 'MODERATOR', 'ULTIMATE_MODERATOR'] as const;
export type UserRole = (typeof userRoles)[number];
export const accountStatuses = [
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
  'BANNED',
  'DEACTIVATED',
] as const;
export type AccountStatus = (typeof accountStatuses)[number];
export const reportStatuses = ['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED', 'ESCALATED'] as const;
export type ReportStatus = (typeof reportStatuses)[number];
export const roleLabels: Record<UserRole, string> = {
  STUDENT: 'Student',
  ORGANISER: 'Organiser',
  MODERATOR: 'Moderator',
  ULTIMATE_MODERATOR: 'Ultimate Moderator',
};
export type Principal = { id: string; role: UserRole; accountStatus: AccountStatus };
export const isActive = (user: Principal) => user.accountStatus === 'ACTIVE';
export const canCreateEvent = (user: Principal) =>
  isActive(user) && ['ORGANISER', 'ULTIMATE_MODERATOR'].includes(user.role);
export const canEditEvent = (user: Principal, event: { ownerId: string | null }) =>
  canCreateEvent(user) && (user.role === 'ULTIMATE_MODERATOR' || event.ownerId === user.id);
export const canDeleteEvent = canEditEvent;
export const canApproveVerification = (user: Principal) =>
  isActive(user) && ['MODERATOR', 'ULTIMATE_MODERATOR'].includes(user.role);
export const canBanUser = canApproveVerification;
export const canAssignRole = (user: Principal, targetRole: UserRole) =>
  isActive(user) && user.role === 'ULTIMATE_MODERATOR' && userRoles.includes(targetRole);
export const canViewModerationDashboard = canApproveVerification;
export const canSeeReports = canApproveVerification;
export const canManageReports = canApproveVerification;
