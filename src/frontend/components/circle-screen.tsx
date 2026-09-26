'use client';
import { usePathname } from 'next/navigation';
import { useCircle } from '@/frontend/state/circle-context';
import { Loading } from './ui';
import { canAssignRole, canViewModerationDashboard } from '@/shared/contracts/permissions';
import { HomePage } from '@/frontend/pages/home-page';
import { DiscoverPage } from '@/frontend/features/discover/discover-page';
import { ConnectionsPage } from '@/frontend/features/connections/connections-page';
import { ProfilePage } from '@/frontend/features/profile/profile-page';
import { NotificationsPage } from '@/frontend/features/notifications/notifications-page';
import { EventsPage } from '@/frontend/features/events/events-page';
import { IdeasPage } from '@/frontend/features/ideas/ideas-page';
import { MessagesPage } from '@/frontend/features/messages/messages-page';
import { ModerationDashboard, UserManagement } from '@/frontend/features/moderation/dashboard';

export function CircleScreen({ path }: { path: string }) {
  const currentPath = usePathname();
  const { state } = useCircle();
  // Wait for the destination's server page (including its authorization check).
  if (path !== currentPath) return <Loading />;
  return path === '/discover' ? (
    <DiscoverPage />
  ) : path === '/connections' ? (
    <ConnectionsPage />
  ) : path === '/ideas' ? (
    <IdeasPage />
  ) : path === '/events' ? (
    <EventsPage />
  ) : path === '/messages' ? (
    <MessagesPage />
  ) : path === '/notifications' ? (
    <NotificationsPage />
  ) : path === '/profile' ? (
    <ProfilePage />
  ) : path === '/moderation' ? (
    canViewModerationDashboard(state.me) ? (
      <ModerationDashboard />
    ) : (
      <p role="alert">Moderator access required.</p>
    )
  ) : path === '/moderation/roles' ? (
    canAssignRole(state.me, 'STUDENT') ? (
      <UserManagement rolesOnly />
    ) : (
      <p role="alert">Ultimate Moderator access required.</p>
    )
  ) : (
    <HomePage />
  );
}
