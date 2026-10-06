import { describe, expect, it } from 'vitest';
import { cardSwipeEnabled } from '../src/frontend/components/student-card';

describe('student card swipe gating', () => {
  it('allows drag swipes only in discover mode', () => {
    expect(cardSwipeEnabled(true)).toBe(true);
    expect(cardSwipeEnabled(false)).toBe(false);
  });
});
