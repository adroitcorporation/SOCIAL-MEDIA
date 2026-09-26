import { Suspense } from 'react';
import { CircleApp } from '@/frontend/components/circle-app';
import { Loading } from '@/frontend/components/ui';

// This boundary stays mounted when the catch-all page parameter changes.
export default function CircleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <CircleApp>{children}</CircleApp>
    </Suspense>
  );
}
