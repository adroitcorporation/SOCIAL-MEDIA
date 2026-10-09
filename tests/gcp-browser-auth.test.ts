import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as unknown, authStateReady: vi.fn() },
  create: vi.fn(),
  login: vi.fn(),
  verify: vi.fn(),
  logout: vi.fn(),
  token: vi.fn(),
  persistence: vi.fn(),
  changed: vi.fn(),
  popup: vi.fn(),
  link: vi.fn(),
}));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => mocks.auth,
  browserLocalPersistence: {},
  setPersistence: mocks.persistence,
  createUserWithEmailAndPassword: mocks.create,
  signInWithEmailAndPassword: mocks.login,
  sendEmailVerification: mocks.verify,
  signOut: mocks.logout,
  onIdTokenChanged: mocks.changed,
  sendPasswordResetEmail: vi.fn(),
  confirmPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signInWithPopup: mocks.popup,
  linkWithPopup: mocks.link,
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
  FacebookAuthProvider: class {},
  OAuthProvider: class {},
  applyActionCode: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.persistence.mockResolvedValue(undefined);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'cynk-unit-test');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'cynk-unit-test.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://staging.example.test');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_OAUTH_PROVIDERS', 'google,github');
  mocks.auth.currentUser = null;
  vi.stubGlobal('window', { location: { search: '' } });
});
it('fails closed for unconfigured providers, including LinkedIn', async () => {
  const { googleBrowserAuth, configuredOAuthProviders } =
    await import('../src/frontend/auth/identity-platform-browser');
  expect(configuredOAuthProviders()).toEqual(['google', 'github']);
  await expect(googleBrowserAuth.signInWithOAuth('linkedin')).rejects.toThrow('not configured');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_OAUTH_PROVIDERS', '');
  await expect(googleBrowserAuth.signInWithOAuth('google')).rejects.toThrow('not configured');
  expect(mocks.popup).not.toHaveBeenCalled();
});
it('does not automatically link or reveal credentials on account collision', async () => {
  mocks.popup.mockRejectedValue({
    code: 'auth/account-exists-with-different-credential',
    message: 'private-email and credential',
  });
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  await expect(googleBrowserAuth.signInWithOAuth('github')).rejects.toThrow('existing method');
  expect(mocks.link).not.toHaveBeenCalled();
});
it('links only an authenticated verified user and refreshes the same identity', async () => {
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  await expect(googleBrowserAuth.linkOAuthProvider('google')).rejects.toThrow('verified account');
  expect(mocks.link).not.toHaveBeenCalled();
  const user = { uid: 'stable-prisma-user-id', emailVerified: true, getIdToken: mocks.token };
  mocks.auth.currentUser = user;
  mocks.link.mockResolvedValue({ user });
  await googleBrowserAuth.linkOAuthProvider('google');
  expect(mocks.link.mock.calls[0][0]).toBe(user);
  expect(mocks.token).toHaveBeenCalledWith(true);
});
it('rejects a different linked identity and signs out a changed session', async () => {
  mocks.auth.currentUser = { uid: 'original-id', emailVerified: true };
  mocks.link.mockResolvedValue({ user: { uid: 'different-id' } });
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  await expect(googleBrowserAuth.linkOAuthProvider('github')).rejects.toThrow('session changed');
  expect(mocks.logout).toHaveBeenCalled();
});
it('rejects provider credentials belonging to another user without account merging', async () => {
  mocks.auth.currentUser = { uid: 'original-id', emailVerified: true };
  mocks.link.mockRejectedValue({
    code: 'auth/credential-already-in-use',
    message: 'sensitive provider response',
  });
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  await expect(googleBrowserAuth.linkOAuthProvider('google')).rejects.toThrow('cannot be merged');
  expect(mocks.token).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('requires verification after signup and signs out unconfirmed accounts', async () => {
  const user = { uid: 'synthetic-user', emailVerified: false };
  mocks.create.mockImplementation(async () => {
    mocks.auth.currentUser = user;
    return { user };
  });
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  expect(await googleBrowserAuth.signUp('test@lnmiit.ac.in', 'synthetic-password')).toEqual({
    signedIn: false,
  });
  expect(mocks.verify).toHaveBeenCalledWith(user, {
    url: 'https://staging.example.test/',
    handleCodeInApp: false,
  });
  expect(mocks.logout).toHaveBeenCalled();
});
it('rejects unverified login without issuing an application token', async () => {
  mocks.login.mockResolvedValue({ user: { uid: 'synthetic-user', emailVerified: false } });
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  await expect(googleBrowserAuth.signIn('test@lnmiit.ac.in', 'synthetic-password')).rejects.toThrow(
    'Confirm your email',
  );
  expect(mocks.logout).toHaveBeenCalled();
});
it('persists verified sessions and requests a current Google token', async () => {
  mocks.token.mockResolvedValue('synthetic-token');
  mocks.auth.currentUser = { uid: 'synthetic-user', emailVerified: true, getIdToken: mocks.token };
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  expect(await googleBrowserAuth.session()).toEqual({
    signedIn: true,
    accessToken: 'synthetic-token',
    userId: 'synthetic-user',
  });
  expect(mocks.persistence).toHaveBeenCalledTimes(1);
  expect(mocks.auth.authStateReady).toHaveBeenCalled();
});
it('emits refreshed tokens for the existing HTTP-only page-session bridge', async () => {
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  const callback = vi.fn();
  googleBrowserAuth.subscribe(callback);
  const listener = mocks.changed.mock.calls[0][1];
  const user = { emailVerified: true, getIdToken: mocks.token };
  mocks.token.mockResolvedValueOnce('synthetic-first').mockResolvedValueOnce('synthetic-refreshed');
  await listener(user);
  await listener(user);
  expect(callback.mock.calls.map((call) => call[0].accessToken)).toEqual([
    'synthetic-first',
    'synthetic-refreshed',
  ]);
  expect(callback.mock.calls[1][0].signedIn).toBe(true);
  mocks.token.mockRejectedValueOnce(new Error('sensitive provider detail'));
  await listener(user);
  expect(callback).toHaveBeenLastCalledWith({ signedIn: false, recoveringPassword: false });
});
it('does not let a delayed token refresh undo a newer logout event', async () => {
  const { googleBrowserAuth } = await import('../src/frontend/auth/identity-platform-browser');
  const callback = vi.fn();
  googleBrowserAuth.subscribe(callback);
  const listener = mocks.changed.mock.calls[0][1];
  let finish: (token: string) => void = () => {};
  mocks.token.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = listener({ emailVerified: true, getIdToken: mocks.token });
  await listener(null);
  finish('stale-synthetic-token');
  await pending;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][0].signedIn).toBe(false);
});
