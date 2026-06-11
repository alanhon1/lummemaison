import countries from 'world-countries';

// Sorted list of countries for the signup / checkout shipping form.
// Excludes South Korea (KR) — Lumée Maison does not ship to the Korean domestic market.
export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dialCode: string; // e.g. "+1"
}

export const COUNTRIES: Country[] = countries
  .filter(c => c.cca2 !== 'KR')
  .map(c => ({
    code: c.cca2,
    name: c.name.common,
    dialCode: c.idd?.root
      ? `${c.idd.root}${c.idd.suffixes?.[0] ?? ''}`
      : '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

// Map any stored country value to a valid ISO alpha-2 code, or '' if unknown.
// Guards the <select> against falling through to its first option (Afghanistan)
// when the value is null/empty or a legacy full name like "United States".
export function resolveCountryCode(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.trim();
  if (COUNTRIES.some(c => c.code === v)) return v; // exact code
  const byCode = COUNTRIES.find(c => c.code === v.toUpperCase()); // case-insensitive code
  if (byCode) return byCode.code;
  const byName = COUNTRIES.find(c => c.name.toLowerCase() === v.toLowerCase()); // legacy full name
  if (byName) return byName.code;
  return ''; // unknown → placeholder
}
