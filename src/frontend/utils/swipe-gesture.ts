export type SwipeDirection = 'pending' | 'horizontal' | 'vertical';
export function lockSwipeDirection(
  direction: SwipeDirection,
  deltaX: number,
  deltaY: number,
): SwipeDirection {
  if (direction !== 'pending' || Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10)
    return direction;
  if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) return 'horizontal';
  if (Math.abs(deltaY) > Math.abs(deltaX)) return 'vertical';
  return 'pending';
}
export function completesSwipe(delta: number, velocity: number, width: number) {
  return (
    Math.abs(delta) >= width * 0.28 || (Math.abs(delta) > 45 && Math.sign(delta) * velocity > 0.55)
  );
}
