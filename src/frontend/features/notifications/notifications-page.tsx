'use client';
import { relative } from '@/frontend/utils/date';
import { useState } from 'react';

import { ArrowUpRight, Bell, CheckCheck } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';
import { Empty } from '@/frontend/components/ui';

import { PageHeading } from '@/frontend/components/page-heading';
export function NotificationsPage() {
  const { api, state, mutate, navigate, busy } = useCircle();
  const [unread, setUnread] = useState(false);
  const items = state.notifications.filter((n) => !unread || !n.readAt);
  return (
    <>
      <PageHeading
        eyebrow="YOU’RE PART OF SOMETHING"
        title="A little update from your circle."
        description="New connections, fresh collaborations, and ideas that resonate."
      >
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            try {
              await mutate(() => api.notifications.markRead());
            } catch {}
          }}
        >
          <CheckCheck size={17} />
          Mark all read
        </button>
      </PageHeading>
      <div className="tabs">
        <button className={!unread ? 'active' : ''} onClick={() => setUnread(false)}>
          All updates
        </button>
        <button className={unread ? 'active' : ''} onClick={() => setUnread(true)}>
          Unread<span>{state.notifications.filter((n) => !n.readAt).length}</span>
        </button>
      </div>
      <div className="notification-list">
        {items.map((n) => (
          <button
            className={`notification-row ${!n.readAt ? 'unread' : ''}`}
            key={n.id}
            onClick={async () => {
              try {
                await mutate(() => api.notifications.markRead(n.id));
                navigate(n.href);
              } catch {}
            }}
          >
            <span className="stat-icon mint">
              <Bell size={21} />
            </span>
            <div>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{relative(n.createdAt)}</small>
            </div>
            {!n.readAt && <span className="status-dot" />}
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="All quiet, in a good way."
          body="We’ll let you know when something new happens in your circle."
        />
      )}
    </>
  );
}
