import type { Metadata } from 'next';
import { brand } from '@/shared/config/brand';
import '@/frontend/styles/globals.css';
import { ThemeProvider } from '@/frontend/theme/theme-provider';
import { themeScript } from '@/frontend/theme/theme-script';
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
