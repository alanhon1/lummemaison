'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { signup, type FormState } from '@/app/[locale]/account/actions';
import CountrySelect from './CountrySelect';

const initialState: FormState = {};

export default function SignupForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '';
  const [country, setCountry] = useState('');
  const [state, formAction, pending] = useActionState(signup, initialState);

  const showFedex = country === 'US';
  const signInHref = returnTo
    ? `/${locale}/account/login?returnTo=${encodeURIComponent(returnTo)}`
    : `/${locale}/account/login`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <Field id="fullName" label={t('fields.fullName')} required>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="email" label={t('fields.email')} required>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </Field>
        <Field id="password" label={t('fields.password')} hint={t('fields.passwordHint')} required>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
      </div>

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
        <input
          id="street"
          name="street"
          type="text"
          required
          autoComplete="street-address"
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field id="city" label={t('fields.city')} required>
          <input
            id="city"
            name="city"
            type="text"
            required
            autoComplete="address-level2"
            className={inputClass}
          />
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
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            required
            autoComplete="postal-code"
            className={inputClass}
          />
        </Field>
      </div>

      {showFedex && (
        <Field id="fedexAccount" label={t('fields.fedexAccount')} hint={t('fields.fedexHint')}>
          <input
            id="fedexAccount"
            name="fedexAccount"
            type="text"
            className={inputClass}
          />
        </Field>
      )}

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
        {pending ? t('signup.submitting') : t('signup.submit')}
      </button>

      <p className="text-xs text-mist text-center">
        {t('signup.haveAccount')}{' '}
        <Link href={signInHref} className="text-gold-dark hover:text-gold underline underline-offset-2">
          {t('signup.signIn')}
        </Link>
      </p>
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
