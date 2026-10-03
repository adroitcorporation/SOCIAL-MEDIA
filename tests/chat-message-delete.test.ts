import { describe, expect, it } from 'vitest';
import { canDeleteOwnMessage } from '@/backend/services/messages';

describe('canDeleteOwnMessage', () => {
  it('allows deleting a sent message within seven minutes', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const createdAt = new Date('2026-01-01T11:57:00Z');

    expect(canDeleteOwnMessage('user-1', 'user-1', createdAt, now)).toBe(true);
  });

  it('blocks deletion after seven minutes', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const createdAt = new Date('2026-01-01T11:52:00Z');

    expect(canDeleteOwnMessage('user-1', 'user-1', createdAt, now)).toBe(false);
  });

  it('blocks deleting someone else\'s message', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const createdAt = new Date('2026-01-01T11:58:00Z');

    expect(canDeleteOwnMessage('user-1', 'user-2', createdAt, now)).toBe(false);
  });
});
