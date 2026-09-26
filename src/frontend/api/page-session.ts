// Catch-all page navigation remounts the controller. Keep only the cookie-sync
// marker here, never account data or authorization decisions.
let synchronized: { token: string; expiresAt: number } | undefined;
let pending: { token?: string; promise: Promise<void> } | undefined;
let queue = Promise.resolve();

function serializeCookieWrite(write: () => Promise<void>, token?: string) {
  const promise = queue
    .catch(() => {})
    .then(write)
    .finally(() => {
      if (pending?.promise === promise) pending = undefined;
    });
  pending = { token, promise };
  queue = promise;
  return promise;
}

export function syncPageSession(token: string): Promise<void> {
  if (pending?.token === token) return pending.promise;
  if (!pending && synchronized?.token === token && Date.now() < synchronized.expiresAt)
    return Promise.resolve();
  return serializeCookieWrite(async () => {
    const response = await fetch('/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok)
      throw new Error('Your session is unavailable. Sign in with an active account.');
    synchronized = { token, expiresAt: Date.now() + 60000 };
  }, token);
}
export function clearPageSession() {
  synchronized = undefined;
  return serializeCookieWrite(async () => {
    // Wait for earlier POSTs before deleting, so a late response cannot undo logout.
    synchronized = undefined;
    const response = await fetch('/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok)
      throw new Error('Unable to clear the page session. Please try signing out again.');
  });
}
