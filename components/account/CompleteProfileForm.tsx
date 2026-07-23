'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { completeProfile, type FormState } from '@/app/[locale]/account/actions';
import CountrySelect from './CountrySelect';

const initialState: FormState = {};

// Repair form for a signed-in account whose customer_profiles row is missing.
// Same fields as signup minus email/password (the login already exists).
export default function CompleteProfileForm({ defaultName }: { defaultName?: string }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [country, setCountry] = useState('');
  const [state, formAction, pending] = useActionState(completeProfile, initialState);

  const showFedex = country === 'US';

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      <Field id="fullName" label={t('fields.fullName')} required>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={defaultName ?? ''}
          autoComplete="name"
          className={inputClass}
        />
      </Field>

      <Field id="phone" label={t('fields.phone')} hint={t('fields.phoneHint')} required>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          className={inputClass}
        />
      </Field>

      <Field id="country" label={t('fields.country')} required>
        <CountrySelect id="country" value={country} onChange={setCountry} required />
      </Field>

      <Field id="street" label={t('fields.street')} required>
        <input id="street" name="street" type="text" required autoComplete="street-address" className={inputClass} />
      </Field>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field id="city" label={t('fields.city')} required>
          <input id="city" name="city" type="text" required autoComplete="address-level2" className={inputClass} />
        </Field>
        <Field id="stateProvince" label={t('fields.stateProvince')}>
          <input
            id="stateProvince"
            name="stateProvince"
            type="text"
            autoComplete="address-level1"
            className={inputClass}
          />
        </Field>
        <Field id="postalCode" label={t('fields.postalCode')} required>
          <input id="postalCode" name="postalCode" type="text" required autoComplete="postal-code" className={inputClass} />
        </Field>
      </div>

      {showFedex && (
        <Field id="fedexAccount" label={t('fields.fedexAccount')} hint={t('fields.fedexHint')}>
          <input id="fedexAccount" name="fedexAccount" type="text" className={inputClass} />
        </Field>
      )}

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
        {pending ? t('completeProfile.submitting') : t('completeProfile.submit')}
      </button>
    </form>
  );
}

const inputClass =
  'w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors';

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
        {label}
        {required && <span className="text-gold-dark ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-mist mt-1.5">{hint}</p>}
    </div>
  );
}
