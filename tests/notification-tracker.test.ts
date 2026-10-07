import { describe, expect, it } from 'vitest';
import {
  NotificationTracker,
  notificationDestination,
} from '@/frontend/state/notification-tracker';
import type { NotificationItem } from '@/shared/contracts/responses';

const item = (id: string, readAt: string | null = null, userId = 'me'): NotificationItem => ({
  id,
  userId,
  title: 'New connection request',
  body: 'A student wants to connect',
  href: '/connections',
  readAt,
  createdAt: '2026-10-07T10:00:00.000Z',
});
describe('global notification deduplication', () => {
  it('suppresses the initial backlog, shows new unread activity once, and survives repeated snapshots/reconnection', () => {
    const tracker = new NotificationTracker();
    expect(tracker.collect('me', [item('old')])).toEqual([]);
    expect(tracker.collect('me', [item('new'), item('old')]).map((entry) => entry.id)).toEqual([
      'new',
    ]);
    expect(tracker.collect('me', [item('new'), item('old')])).toEqual([]);
    expect(tracker.collect('me', [item('new', '2026-10-07')])).toEqual([]);
    expect(
      tracker.collect('me', [
        item('already-read', '2026-10-07'),
        item('other-account', null, 'other'),
      ]),
    ).toEqual([]);
  });
  it('resets on account changes without replaying either account backlog', () => {
    const tracker = new NotificationTracker();
    tracker.collect('me', []);
    expect(tracker.collect('me', [item('one')])).toHaveLength(1);
    expect(tracker.collect(undefined, [])).toEqual([]);
    expect(tracker.collect('other', [item('other-old', null, 'other')])).toEqual([]);
    expect(tracker.collect('other', [item('other-new', null, 'other')])).toHaveLength(1);
  });
  it.each(['https://attacker.test', '//attacker.test', 'javascript:alert(1)', '/\\attacker.test'])(
    'rejects external or malformed notification destinations: %s',
    (href) => expect(notificationDestination(href)).toBe('/notifications'),
  );
  it('keeps contextual internal destinations', () =>
    expect(notificationDestination('/messages?conversation=group')).toBe(
      '/messages?conversation=group',
    ));
});
