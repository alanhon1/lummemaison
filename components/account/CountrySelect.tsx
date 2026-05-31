'use client';

import { COUNTRIES } from '@/lib/countries';

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
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
    >
      <option value="" disabled>
        Select a country
      </option>
      {COUNTRIES.map(c => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
