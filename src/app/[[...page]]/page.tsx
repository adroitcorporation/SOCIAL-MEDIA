import { CircleApp } from '@/frontend/components/circle-app';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { pageIdentity, pageSessionCookie } from '@/backend/auth/page-session';
import { canViewModerationDashboard, canAssignRole } from '@/shared/contracts/permissions';
export default async function Page({ params }: { params: Promise<{ page?: string[] }> }) {
  const { page } = await params;
  const route = (page || []).join('/');
  if (
    ![
      '',
      'discover',
      'connections',
      'ideas',
      'events',
      'messages',
      'notifications',
      'profile',
      'moderation',
      'moderation/roles',
      'login',
      'signup',
      'reset-password',
    ].includes(route)
  )
    notFound();
  if (route === 'moderation' || route === 'moderation/roles') {
    let allowed = false;
    try {
      const user = await pageIdentity((await cookies()).get(pageSessionCookie)?.value);
      allowed =
        route === 'moderation/roles'
          ? canAssignRole(user, 'STUDENT')
          : canViewModerationDashboard(user);
    } catch {}
    if (!allowed)
      return (
        <main className="auth-page">
          <section className="panel">
            <h1>Access denied</h1>
            <p>
              An active {route.endsWith('/roles') ? 'Ultimate Moderator' : 'moderator'} account is
              required.
            </p>
            <a className="button primary" href="/">
              Return to your circle or sign in
            </a>
          </section>
        </main>
      );
  }
  return (
    <Suspense fallback={<div className="loading">Finding your circle…</div>}>
      <CircleApp />
    </Suspense>
  );
}
