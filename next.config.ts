import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Host of the Supabase project, derived from env, so newly-uploaded product
// images (served from the public `product-images` Storage bucket) pass through
// next/image. Falls back to no remote patterns if the env var is unset.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname || undefined;
  } catch {
    return undefined;
  }
})();

// Content-Security-Policy. Scoped to what the storefront actually loads:
// same-origin code, Supabase (auth/storage/realtime) for connect + images, and
// data: images. `'unsafe-inline'` is kept for script/style because Next.js App
// Router injects inline hydration scripts and Tailwind/framer-motion emit inline
// styles; tightening to nonces is a follow-up. `frame-ancestors 'none'` and
// `object-src 'none'` are the high-value anti-clickjacking / anti-injection
// directives. Supabase origin is derived from env (see supabaseHost below).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}`,
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy',  value: csp },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  images: {
    formats: ['image/webp'],
    localPatterns: [
      { pathname: '/images/products/**' },
      { pathname: '/images/bundles/**' },
      { pathname: '/hero-maison.jpg' },
      { pathname: '/ai-assistant.png' },
    ],
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
  serverExternalPackages: ['sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withNextIntl(nextConfig);
