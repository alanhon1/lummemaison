'use client';

import { COUNTRIES, resolveCountryCode } from '@/lib/countries';

interface Props {
  name?: string;
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  id?: string;
}

export default function CountrySelect({ name = 'country', value, onChange, required, id }: Props) {
  return (
    <select
      id={id}
      name={name}
      value={resolveCountryCode(value)}
      onChange={e => onChange(e.target.value)}
      required={required}
      className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
    >
      {/*
        Placeholder MUST NOT be `disabled`. A controlled <select> whose value is
        "" (no country resolved yet) needs a real value="" option to match — iOS
        Safari skips a disabled placeholder and instead shows/selects the first
        enabled option (Afghanistan), which then gets silently submitted and
        saved. Keeping it enabled makes "" match the placeholder on every
        browser; `required` still blocks submitting with no country chosen.
      */}
      <option value="">Select a country</option>
      {COUNTRIES.map(c => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
