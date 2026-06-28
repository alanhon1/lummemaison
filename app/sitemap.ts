import type { MetadataRoute } from 'next';
import { locales, localePath } from '@/lib/i18n';

const BASE = 'https://lumeemaison.com';
const ROUTES = ['/', '/catalogue', '/about', '/contact', '/faq'];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap(l =>
    ROUTES.map(r => ({
      url: BASE + localePath(l, r),
      changeFrequency: 'weekly' as const,
    }))
  );
}
