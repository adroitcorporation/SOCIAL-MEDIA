import { authClient } from './supabase-browser';

function resolveRedirectOrigin(fallbackOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const candidate =
    configured || fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!candidate) throw new Error('Authentication redirect origin is unavailable.');

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Invalid origin');
    }
    return url.origin;
  } catch {
    throw new Error('Authentication redirect origin must be a valid HTTP(S) URL.');
  }
}

// Browser session persistence is an auth-provider adapter. Authorization stays on the server.
export const browserAuth = {
  async session() {
    const { data } = await authClient().auth.getSession();
    return { signedIn: Boolean(data.session), accessToken: data.session?.access_token };
  },
  subscribe(onChange: (session: { signedIn: boolean; recoveringPassword: boolean }) => void) {
    const { data } = authClient().auth.onAuthStateChange((event, session) =>
      onChange({ signedIn: Boolean(session), recoveringPassword: event === 'PASSWORD_RECOVERY' }),
    );
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    const { error } = await authClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signUp(email: string, password: string, origin?: string) {
    const redirectOrigin = resolveRedirectOrigin(origin);
    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${redirectOrigin}/` },
    });
    if (error) throw error;
    return { signedIn: Boolean(data.session) };
  },
  async requestPasswordReset(email: string, origin?: string) {
    const redirectOrigin = resolveRedirectOrigin(origin);
    const { error } = await authClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectOrigin}/reset-password`,
    });
    if (error) throw error;
  },
  async updatePassword(password: string) {
    const { error } = await authClient().auth.updateUser({ password });
    if (error) throw error;
  },
  async signOut() {
    const { error } = await authClient().auth.signOut();
    if (error) throw error;
  },
};
