'use client';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { NotificationItem } from '@/shared/contracts/responses';

export function NotificationToasts({
  items,
  dismiss,
  open,
}: {
  items: NotificationItem[];
  dismiss: (id: string) => void;
  open: (item: NotificationItem) => void;
}) {
  return (
    <div className="notification-toast-stack" aria-live="polite" aria-label="New activity">
      {items.map((item) => (
        <NotificationToast key={item.id} item={item} dismiss={dismiss} open={open} />
      ))}
    </div>
  );
}

function NotificationToast({
  item,
  dismiss,
  open,
}: {
  item: NotificationItem;
  dismiss: (id: string) => void;
  open: (item: NotificationItem) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (!paused && document.visibilityState === 'visible')
        timer = setTimeout(() => dismiss(item.id), 8000);
    };
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [item.id, dismiss, paused]);
  return (
    <div
      className="notification-toast"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <button className="notification-toast-open" onClick={() => open(item)}>
        <Bell size={20} aria-hidden="true" />
        <span>
          <strong>{item.title}</strong>
          <span>{item.body}</span>
        </span>
      </button>
      <button
        className="icon-button"
        aria-label={`Dismiss ${item.title}`}
        onClick={() => dismiss(item.id)}
      >
        <X size={18} />
      </button>
    </div>
  );
}
