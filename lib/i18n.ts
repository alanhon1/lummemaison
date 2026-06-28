export const locales = ['en', 'ru', 'fr', 'es'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// Builds a locale-aware path. English (the default locale) is served at the
// root with NO prefix; other locales are prefixed (e.g. `/ru/...`). Use this
// everywhere instead of hand-building `/${locale}/...` so internal links don't
// emit `/en/...` (which would 301-redirect to the unprefixed path on every click).
//
//   localePath('en', '/catalogue') -> '/catalogue'
//   localePath('ru', '/catalogue') -> '/ru/catalogue'
//   localePath('en')               -> '/'
//   localePath('ru')               -> '/ru'
export function localePath(locale: string, path: string = '/'): string {
  const clean = !path ? '/' : path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}
