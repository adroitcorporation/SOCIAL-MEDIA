import { authClient } from './supabase-browser';
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
  async signUp(email: string, password: string, origin: string) {
    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/` },
    });
    if (error) throw error;
    return { signedIn: Boolean(data.session) };
  },
  async requestPasswordReset(email: string, origin: string) {
    const { error } = await authClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
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
