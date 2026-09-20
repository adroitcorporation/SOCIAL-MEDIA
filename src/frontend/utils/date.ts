export function relative(date: string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return min < 1
    ? 'Just now'
    : min < 60
      ? `${min}m ago`
      : min < 1440
        ? `${Math.floor(min / 60)}h ago`
        : `${Math.floor(min / 1440)}d ago`;
}
