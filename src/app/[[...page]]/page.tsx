import { CircleApp } from '@/frontend/components/circle-app';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
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
      'login',
      'signup',
      'reset-password',
    ].includes(route)
  )
    notFound();
  return (
    <Suspense fallback={<div className="loading">Finding your circle…</div>}>
      <CircleApp />
    </Suspense>
  );
}
