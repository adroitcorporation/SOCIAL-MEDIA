import type { Metadata } from 'next';
import { brand } from '@/shared/config/brand';
import '@/frontend/styles/globals.css';
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
