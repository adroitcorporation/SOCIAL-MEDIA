'use client';
import { useState } from 'react';
import { ArrowRight, Circle, Mail, ShieldCheck } from 'lucide-react';
import { browserAuth } from '@/frontend/auth/browser-auth';
import { brand } from '@/shared/config/brand';
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
        await browserAuth.requestPasswordReset(email, location.origin);
        setNotice('If an account exists, a reset link is on its way. Check your inbox.');
      } else if (mode === 'reset') {
        await browserAuth.updatePassword(password);
        setNotice('Password updated. You can continue to your circle.');
        onAuthenticated();
      } else if (mode === 'signup') {
        const result = await browserAuth.signUp(email, password, location.origin);
        if (result.signedIn) onAuthenticated();
        else
          setNotice('Check your inbox to verify your email, then sign in to create your profile.');
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
  return (
    <main className="auth-page">
      <div className="auth-story">
        <div className="wordmark">
          <span className="brand-mark">
            <Circle size={23} />
          </span>
          {brand.name}
        </div>
        <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
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
          <ShieldCheck size={16} /> Real students. Meaningful connections.
        </small>
      </div>
      <section className="auth-card">
        <span className="eyebrow">A LITTLE INTRODUCTION, A LOT OF POSSIBILITY</span>
        <h2>
          {mode === 'signup'
            ? 'Join the circle.'
            : mode === 'forgot'
              ? 'Forgot your password?'
              : mode === 'reset'
                ? 'A fresh start.'
                : 'Welcome back.'}
        </h2>
        <p>
          {mode === 'signup'
            ? 'Your next collaborator could be one hello away.'
            : 'Pick up where inspiration left off.'}
        </p>
        {!configured && (
          <div className="notice">
            Authentication needs configuration. Add your Supabase URL and publishable key to start,
            or follow the local demo instructions in README.md.
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== 'reset' && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@college.edu"
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
                ? 'Create your account'
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
          {mode === 'login' ? 'New around here?' : 'Already part of the circle?'}{' '}
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
