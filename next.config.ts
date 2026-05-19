import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp'],
    localPatterns: [
      { pathname: '/images/products/**' },
      { pathname: '/images/bundles/**' },
    ],
  },
  serverExternalPackages: ['sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withNextIntl(nextConfig);
