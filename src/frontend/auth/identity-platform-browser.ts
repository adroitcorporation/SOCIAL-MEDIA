import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updatePassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  applyActionCode,
  verifyPasswordResetCode,
} from 'firebase/auth';

let ready: Promise<ReturnType<typeof getAuth>> | undefined;
let emailAction: Promise<'verified' | 'password-reset' | undefined> | undefined;
function configuredAuth() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (!projectId || !apiKey || !appId || authDomain !== projectId + '.firebaseapp.com')
    throw new Error('Google authentication is not configured consistently.');
  const name = 'cynk-' + projectId;
  const app =
    getApps().find((app) => app.name === name) ||
    initializeApp({ projectId, apiKey, appId, authDomain }, name);
  return getAuth(app);
}
async function client() {
  if (!ready) {
    const auth = configuredAuth();
    ready = setPersistence(auth, browserLocalPersistence).then(() => auth);
  }
  return ready;
}
function redirect(path = '') {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Authentication redirect origin is invalid.');
  return { url: url.origin + '/' + path, handleCodeInApp: false };
}
function action() {
  const query = new URLSearchParams(window.location.search);
  return { mode: query.get('mode'), code: query.get('oobCode') };
}
export const googleBrowserAuth = {
  async session() {
    const auth = await client();
    await auth.authStateReady();
    const user = auth.currentUser;
    return {
      signedIn: Boolean(user?.emailVerified),
      accessToken: user?.emailVerified ? await user.getIdToken() : undefined,
      userId: user?.emailVerified ? user.uid : undefined,
    };
  },
  subscribe(
    callback: (session: {
      signedIn: boolean;
      recoveringPassword: boolean;
      accessToken?: string;
    }) => void,
  ) {
    const auth = configuredAuth();
    let active = true;
    let version = 0;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      const event = ++version;
      try {
        const accessToken = user?.emailVerified ? await user.getIdToken() : undefined;
        if (!active || event !== version) return;
        callback({
          signedIn: Boolean(user?.emailVerified),
          recoveringPassword: action().mode === 'resetPassword',
          accessToken,
        });
      } catch {
        if (active && event === version) callback({ signedIn: false, recoveringPassword: false });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  },
  async signUp(email: string, password: string) {
    const auth = await client();
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user, redirect());
      return { signedIn: false };
    } finally {
      if (auth.currentUser && !auth.currentUser.emailVerified) await signOut(auth);
    }
  },
  async signIn(email: string, password: string) {
    const auth = await client();
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!result.user.emailVerified) {
      await signOut(auth);
      throw new Error('Confirm your email before signing in.');
    }
  },
  async signInWithOAuth(provider: 'google' | 'github' | 'facebook' | 'linkedin') {
    const auth = await client();
    const providers = {
      google: new GoogleAuthProvider(),
      github: new GithubAuthProvider(),
      facebook: new FacebookAuthProvider(),
      linkedin: new OAuthProvider('oidc.linkedin'),
    };
    const result = await signInWithPopup(auth, providers[provider]);
    if (!result.user.emailVerified) {
      await signOut(auth);
      throw new Error('Confirm your email before signing in.');
    }
  },
  async requestPasswordReset(email: string) {
    await sendPasswordResetEmail(await client(), email, redirect('reset-password'));
  },
  async updatePassword(password: string) {
    const auth = await client();
    const { mode, code } = action();
    if (mode === 'resetPassword' && code) {
      await confirmPasswordReset(auth, code, password);
      window.history.replaceState(null, '', window.location.pathname);
      await signOut(auth);
    } else {
      if (!auth.currentUser) throw new Error('Open a valid password-reset link or sign in again.');
      await updatePassword(auth.currentUser, password);
    }
  },
  completeEmailAction() {
    // React Strict Mode may run effects twice. Consume an email action only once.
    return (emailAction ??= completeEmailAction());
  },
  async signOut() {
    await signOut(await client());
  },
};
async function completeEmailAction() {
  const { mode, code } = action();
  if (!code) return;
  const auth = await client();
  if (mode === 'verifyEmail') {
    await applyActionCode(auth, code);
    window.history.replaceState(null, '', window.location.pathname);
    if (auth.currentUser) {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
    }
    return 'verified' as const;
  }
  if (mode === 'resetPassword') {
    await verifyPasswordResetCode(auth, code);
    return 'password-reset' as const;
  }
}
