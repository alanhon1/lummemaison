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

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp'],
    localPatterns: [
      { pathname: '/images/products/**' },
      { pathname: '/images/bundles/**' },
      { pathname: '/hero-maison.jpg' },
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
