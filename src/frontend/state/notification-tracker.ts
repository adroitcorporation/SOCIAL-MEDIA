import type { NotificationItem } from '@/shared/contracts/responses';

// One tracker per authenticated app shell; reconnects and route changes don't reset it.
export class NotificationTracker {
  private userId?: string;
  private seen = new Set<string>();

  collect(userId: string | undefined, items: NotificationItem[]) {
    if (userId !== this.userId) {
      this.userId = userId;
      this.seen = new Set(items.map((item) => item.id));
      return [];
    }
    if (!userId) return [];
    const fresh = items.filter(
      (item) => item.userId === userId && !this.seen.has(item.id) && !item.readAt,
    );
    for (const item of items) this.seen.add(item.id);
    while (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value!);
    return fresh.reverse();
  }
}

export function notificationDestination(href: string) {
  return href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')
    ? href
    : '/notifications';
}
