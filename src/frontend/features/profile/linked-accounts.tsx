'use client';

import { useState } from 'react';
import { browserAuth } from '@/frontend/auth/browser-auth';

export function LinkedAccounts() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const providers = browserAuth.availableOAuthProviders();
  if (!browserAuth.supportsProviderLinking() || !providers.length) return null;
  return (
    <section className="panel" aria-label="Linked accounts">
      <h3>Linked accounts</h3>
      <p className="muted">Link another sign-in method to your current account.</p>
      {providers.map((provider) => (
        <button
          key={provider}
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage('');
            try {
              await browserAuth.linkOAuthProvider(provider);
              setMessage('Sign-in method linked to your account.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Unable to link account.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Link {provider === 'github' ? 'GitHub' : provider === 'linkedin' ? 'LinkedIn' : 'Google'}
        </button>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
