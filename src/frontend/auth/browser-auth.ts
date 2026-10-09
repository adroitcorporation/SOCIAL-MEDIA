import { authClient } from './supabase-browser';
import { authProvider } from '@/shared/config/auth-provider';
import {
  googleBrowserAuth,
  configuredOAuthProviders,
  type GoogleOAuthProvider,
} from './identity-platform-browser';
const google = () => authProvider(process.env.NEXT_PUBLIC_AUTH_PROVIDER) === 'identity-platform';

function resolveRedirectOrigin() {
  const candidate = process.env.NEXT_PUBLIC_APP_URL;
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
  availableOAuthProviders(): GoogleOAuthProvider[] {
    return google() ? configuredOAuthProviders() : ['google', 'linkedin', 'github', 'facebook'];
  },
  supportsProviderLinking() {
    return google();
  },
  async linkOAuthProvider(provider: GoogleOAuthProvider) {
    if (!google()) throw new Error('Account linking is unavailable for this environment.');
    return googleBrowserAuth.linkOAuthProvider(provider);
  },
  async session() {
    if (google()) return googleBrowserAuth.session();
    const { data } = await authClient().auth.getSession();
    return {
      signedIn: Boolean(data.session),
      accessToken: data.session?.access_token,
      userId: data.session?.user.id,
    };
  },
  subscribe(
    onChange: (session: {
      signedIn: boolean;
      recoveringPassword: boolean;
      accessToken?: string;
    }) => void,
  ) {
    if (google()) return googleBrowserAuth.subscribe(onChange);
    const { data } = authClient().auth.onAuthStateChange((event, session) =>
      onChange({ signedIn: Boolean(session), recoveringPassword: event === 'PASSWORD_RECOVERY' }),
    );
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    if (google()) return googleBrowserAuth.signIn(email, password);
    const { error } = await authClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signInWithOAuth(provider: 'google' | 'github' | 'facebook' | 'linkedin') {
    if (google()) return googleBrowserAuth.signInWithOAuth(provider);
    const redirectOrigin = resolveRedirectOrigin();
    const { error } = await authClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${redirectOrigin}/` },
    });
    if (error) throw error;
  },
  // Legacy callers may pass an origin; redirects always use public configuration.
  async signUp(email: string, password: string, _origin?: string) {
    if (google()) return googleBrowserAuth.signUp(email, password);
    const redirectOrigin = resolveRedirectOrigin();
    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${redirectOrigin}/` },
    });
    if (error) throw error;
    return { signedIn: Boolean(data.session) };
  },
  async requestPasswordReset(email: string, _origin?: string) {
    if (google()) return googleBrowserAuth.requestPasswordReset(email);
    const redirectOrigin = resolveRedirectOrigin();
    const { error } = await authClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectOrigin}/reset-password`,
    });
    if (error) throw error;
  },
  async updatePassword(password: string) {
    if (google()) return googleBrowserAuth.updatePassword(password);
    const { error } = await authClient().auth.updateUser({ password });
    if (error) throw error;
  },
  async signOut() {
    if (google()) return googleBrowserAuth.signOut();
    const { error } = await authClient().auth.signOut();
    if (error) throw error;
  },
  async completeEmailAction() {
    if (google()) return googleBrowserAuth.completeEmailAction();
  },
};
