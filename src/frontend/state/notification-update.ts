import type { AppState, NotificationSnapshot } from '@/shared/contracts/responses';
export function applyNotificationSnapshot(
  current: AppState,
  result: NotificationSnapshot,
): AppState {
  return Array.isArray(result.items)
    ? { ...current, notifications: result.items, notificationUnread: result.unreadCount }
    : current;
}
