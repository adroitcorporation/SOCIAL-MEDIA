'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Circle, GitBranch, Globe, Mail, ShieldCheck } from 'lucide-react';
import { browserAuth } from '@/frontend/auth/browser-auth';
import { brand } from '@/shared/config/brand';

const socialProviders = [
  { provider: 'google', label: 'Google' },
  { provider: 'linkedin', label: 'LinkedIn' },
  { provider: 'github', label: 'GitHub' },
  { provider: 'facebook', label: 'Facebook' },
] as const;
export function AuthForm({
  configured,
  initialMode = 'login',
  onAuthenticated,
}: {
  configured: boolean;
  initialMode?: string;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void browserAuth
      .completeEmailAction()
      .then((result) => {
        if (!active) return;
        if (result === 'verified') {
          setMode('login');
          setNotice('Email verified. Sign in to continue.');
        }
        if (result === 'password-reset') setMode('reset');
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : 'The email link is invalid or expired.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    try {
      if (mode === 'forgot') {
        await browserAuth.requestPasswordReset(email);
        setNotice('If an account exists, a reset link is on its way. Check your inbox.');
      } else if (mode === 'reset') {
        await browserAuth.updatePassword(password);
        setNotice('Password updated. You can continue to your circle.');
        if (process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'identity-platform') {
          setMode('login');
          setNotice('Password updated. Sign in to continue.');
        } else onAuthenticated();
      } else if (mode === 'signup') {
        const result = await browserAuth.signUp(email, password);
        if (result.signedIn) onAuthenticated();
        else
          setNotice(
            'Check your inbox and click the confirmation link to verify your email and sign in.',
          );
      } else {
        await browserAuth.signIn(email, password);
        onAuthenticated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialLogin(provider: (typeof socialProviders)[number]['provider']) {
    try {
      setBusy(true);
      setError('');
      setNotice('');
      await browserAuth.signInWithOAuth(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to sign in with ${provider}.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <div className="wordmark">
          <span className="brand-mark">
            <Circle size={23} />
          </span>
          {brand.name}
        </div>
        <h1>
          Find your people.
          <br />
          <em>Make your thing.</em>
        </h1>
        <p>{brand.description}</p>
        <div className="auth-art">
          <span>design</span>
          <span>build</span>
          <span>create</span>
          <span>compete</span>
          <div>together.</div>
        </div>
        <small>
          <ShieldCheck size={16} /> Student community
        </small>
      </div>
      <section className="auth-card">
        <h2>
          {mode === 'signup'
            ? 'Join the circle.'
            : mode === 'forgot'
              ? 'Forgot your password?'
              : mode === 'reset'
                ? 'Reset password'
                : 'Welcome back.'}
        </h2>

        {!configured && (
          <div className="notice">
            Authentication needs configuration. Add the selected provider's public configuration to
            start, or follow the local demo instructions in README.md.
          </div>
        )}
        {mode === 'login' && (
          <div className="social-auth-grid">
            {socialProviders
              .filter(({ provider }) => browserAuth.availableOAuthProviders().includes(provider))
              .map(({ provider, label }) => (
                <button
                  key={provider}
                  type="button"
                  className="button secondary social-auth-button"
                  disabled={busy || !configured}
                  onClick={() => void handleSocialLogin(provider)}
                >
                  {provider === 'google' && <Globe size={16} />}
                  {provider === 'linkedin' && <Mail size={16} />}
                  {provider === 'github' && <GitBranch size={16} />}
                  {provider === 'facebook' && <ShieldCheck size={16} />}
                  {label}
                </button>
              ))}
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== 'reset' && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              <Mail size={18} />
              {notice}
            </p>
          )}
          <button disabled={busy || !configured} className="button primary full">
            {busy
              ? 'One moment…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : mode === 'reset'
                    ? 'Update password'
                    : 'Sign in'}
            <ArrowRight size={16} />
          </button>
        </form>
        {mode === 'login' && (
          <button
            className="text-link"
            onClick={() => {
              setMode('forgot');
              setError('');
              setNotice('');
            }}
          >
            Forgot password?
          </button>
        )}
        <div className="auth-switch">
          {mode === 'login' ? 'New here?' : 'Have an account?'}{' '}
          <button
            className="text-link"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setNotice('');
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </div>
        <small>By joining, be kind, be curious, and respect your fellow students.</small>
      </section>
    </main>
  );
}
