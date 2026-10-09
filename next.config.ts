import type { NextConfig } from 'next';
if (process.env.REQUIRE_EXPLICIT_BACKEND_URL === 'true' && !process.env.BACKEND_URL)
  throw new Error('This frontend requires an explicit isolated BACKEND_URL.');
const googleAuth = process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'identity-platform';
if (googleAuth && process.env.DEPLOYMENT_TARGET !== 'cloud-run' && !process.env.BACKEND_URL)
  throw new Error('Google authentication frontend requires an explicit BACKEND_URL.');
const config: NextConfig = {
  ...(process.env.DEPLOYMENT_TARGET === 'cloud-run'
    ? { output: 'standalone' as const, outputFileTracingRoot: process.cwd() }
    : {}),
  // Publish only the canonical app URL; APP_URL itself remains server-side.
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '',
  },
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.VERCEL_ENV === 'production'
        ? 'https://founder-circle-backend.onrender.com'
        : undefined);
    return {
      // Keep public startup config local; data APIs and live updates use the backend.
      beforeFiles: backendUrl
        ? [
            {
              source: '/api/:path((?!config(?:/|$)).*)',
              destination: `${backendUrl.replace(/\/$/, '')}/api/:path*`,
            },
          ]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${googleAuth ? 'https://apis.google.com' : ''} ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' ${googleAuth ? 'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.firebaseapp.com' : 'https://*.supabase.co wss://*.supabase.co'}; frame-src 'self' ${googleAuth ? 'https://*.firebaseapp.com' : ''}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
