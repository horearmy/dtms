import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
       `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}${process.env.VERCEL === '1' ? ' https://va.vercel-scripts.com' : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.google.com https://*.basemaps.cartocdn.com",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
       `connect-src 'self' https://tile.openstreetmap.org https://*.openstreetmap.org https://nominatim.openstreetmap.org https://*.google.com https://*.basemaps.cartocdn.com https://router.project-osrm.org${process.env.VERCEL === '1' ? ' https://va.vercel-scripts.com https://vitals.vercel-insights.com' : ''}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', '@base-ui/react', 'recharts'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: securityHeaders,
    },
    {
      source: '/_next/static/:path*',
      headers: securityHeaders,
    },
    {
      source: '/:all*(svg|jpg|png|ico|webp)',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/favicon.ico',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
  ],
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
