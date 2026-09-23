import { describe, expect, it } from 'vitest';
import {
  canCreateEvent,
  canEditEvent,
  canDeleteEvent,
  canApproveVerification,
  canBanUser,
  canAssignRole,
  canSeeReports,
  canManageReports,
  canViewModerationDashboard,
  userRoles,
  accountStatuses,
} from '@/shared/contracts/permissions';
describe('permission matrix fails closed', () => {
  for (const role of userRoles)
    for (const accountStatus of accountStatuses) {
      it(`${role} / ${accountStatus}`, () => {
        const user = { id: 'actor', role, accountStatus };
        const active = accountStatus === 'ACTIVE';
        const organiser = active && ['ORGANISER', 'ULTIMATE_MODERATOR'].includes(role);
        const moderator = active && ['MODERATOR', 'ULTIMATE_MODERATOR'].includes(role);
        expect(canCreateEvent(user)).toBe(organiser);
        expect(canEditEvent(user, { ownerId: 'actor' })).toBe(organiser);
        expect(canDeleteEvent(user, { ownerId: 'other' })).toBe(
          active && role === 'ULTIMATE_MODERATOR',
        );
        expect(canEditEvent(user, { ownerId: null })).toBe(active && role === 'ULTIMATE_MODERATOR');
        for (const check of [
          canApproveVerification,
          canBanUser,
          canSeeReports,
          canManageReports,
          canViewModerationDashboard,
        ])
          expect(check(user)).toBe(moderator);
        for (const targetRole of userRoles)
          expect(canAssignRole(user, targetRole)).toBe(active && role === 'ULTIMATE_MODERATOR');
      });
    }
});
