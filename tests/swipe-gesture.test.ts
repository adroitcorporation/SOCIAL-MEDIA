import { describe, expect, it } from 'vitest';
import { completesSwipe, lockSwipeDirection } from '../src/frontend/utils/swipe-gesture';
describe('Discover direction lock', () => {
  it('waits for intent and resolves horizontal and vertical movement', () => {
    expect(lockSwipeDirection('pending', 8, 2)).toBe('pending');
    expect(lockSwipeDirection('pending', 20, 12)).toBe('horizontal');
    expect(lockSwipeDirection('pending', 12, 20)).toBe('vertical');
    expect(lockSwipeDirection('pending', 12, 11)).toBe('pending');
  });
  it('does not change direction after locking', () => {
    expect(lockSwipeDirection('horizontal', 20, 100)).toBe('horizontal');
    expect(lockSwipeDirection('vertical', 100, 20)).toBe('vertical');
  });
  it('completes by proportional distance or intentional flick, not short taps or reverse velocity', () => {
    expect(completesSwipe(90, 0, 320)).toBe(true);
    expect(completesSwipe(-90, 0, 320)).toBe(true);
    expect(completesSwipe(-60, -0.7, 320)).toBe(true);
    expect(completesSwipe(60, -0.7, 320)).toBe(false);
    expect(completesSwipe(30, 2, 320)).toBe(false);
    expect(completesSwipe(60, 0, 320)).toBe(false);
  });
});
