export async function syncPageSession(token: string) {
  const response = await fetch('/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error('Your session is unavailable. Sign in with an active account.');
}
export async function clearPageSession() {
  const response = await fetch('/session', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok)
    throw new Error('Unable to clear the page session. Please try signing out again.');
}
