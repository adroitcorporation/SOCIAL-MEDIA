'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '@/shared/contracts/responses';
import { NotificationTracker } from '@/frontend/state/notification-tracker';

export function useNotificationToasts(userId: string | undefined, items: NotificationItem[]) {
  const tracker = useRef(new NotificationTracker());
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const actor = useRef(userId);
  useEffect(() => {
    if (actor.current !== userId) {
      actor.current = userId;
      setToasts([]);
    }
    const fresh = tracker.current.collect(userId, items);
    if (fresh.length) setToasts((previous) => [...previous, ...fresh].slice(-3));
  }, [userId, items]);
  const dismiss = useCallback(
    (id: string) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  return { toasts, dismiss };
}
