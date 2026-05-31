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
