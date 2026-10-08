/** @param {string | undefined} value @param {string} ref */
export function matchesProjectUrl(value, ref) {
  try {
    const url = new URL(value || '');
    return (
      url.protocol === 'https:' &&
      url.hostname === `${ref}.supabase.co` &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** @param {string | undefined} value @param {string} ref */
export function matchesProjectDatabase(value, ref) {
  try {
    const url = new URL(value || '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return false;
    return (
      url.hostname === `db.${ref}.supabase.co` ||
      (url.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(url.username) === `postgres.${ref}`)
    );
  } catch {
    return false;
  }
}
/** @param {string} photo @param {string | undefined} activeProjectUrl */
export function historicalStoragePhoto(photo, activeProjectUrl) {
  try {
    const image = new URL(photo);
    const active = new URL(activeProjectUrl || '');
    return (
      image.hostname.endsWith('.supabase.co') &&
      image.pathname.startsWith('/storage/v1/') &&
      image.hostname !== active.hostname
    );
  } catch {
    return false;
  }
}
