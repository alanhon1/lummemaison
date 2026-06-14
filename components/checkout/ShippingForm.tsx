'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import CountrySelect from '@/components/account/CountrySelect';
import { resolveCountryCode } from '@/lib/countries';
import { readDraft, writeDraft, type ShippingSnapshot } from '@/lib/checkout/state';
import { localePath } from '@/lib/i18n';
import { highlightField } from '@/lib/checkout/highlightField';

export interface ProfileSeed {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  fedexAccount: string;
}

export default function ShippingForm({ profile }: { profile: ProfileSeed }) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();

  // Prefer any in-progress draft over the profile defaults (so a refresh
  // doesn't lose edits the customer made mid-flow). notes/discountCode are
  // per-order, not seeded from profile.
  const [form, setForm] = useState<ShippingSnapshot>({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    country: resolveCountryCode(profile.country),
    street: profile.street,
    city: profile.city,
    stateProvince: profile.stateProvince,
    postalCode: profile.postalCode,
    fedexAccount: profile.fedexAccount,
    notes: '',
    discountCode: '',
  });
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const draft = readDraft();
    if (draft.shipping) setForm(prev => ({ ...prev, ...draft.shipping }));
    setHydrated(true);
  }, []);

  const showFedex = form.country === 'US';

  function set<K extends keyof ShippingSnapshot>(key: K, value: ShippingSnapshot[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Required fields, in visual order. We validate explicitly (instead of native
  // `required`) so the customer gets a visible error + scroll-to-field on
  // mobile, where the native validation bubble is easy to miss.
  const REQUIRED: Array<{ key: keyof ShippingSnapshot; id: string }> = [
    { key: 'fullName', id: 'ship-fullName' },
    { key: 'email', id: 'ship-email' },
    { key: 'phone', id: 'ship-phone' },
    { key: 'country', id: 'ship-country' },
    { key: 'street', id: 'ship-street' },
    { key: 'city', id: 'ship-city' },
    { key: 'postalCode', id: 'ship-postalCode' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = REQUIRED.find(f => !String(form[f.key] ?? '').trim());
    if (missing) {
      setError(missing.key === 'phone' ? t('errors.phoneRequired') : t('errors.fillHighlighted'));
      highlightField(document.getElementById(missing.id), { focus: true });
      return;
    }
    setError('');
    writeDraft({ shipping: form });
    router.push(localePath(locale, '/checkout/disclaimers'));
  }

  if (!hydrated) {
    return <div className="text-sm text-mist">{t('loading')}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-bone rounded-lg p-6 md:p-8">
      <Field label={t('fields.fullName')} required>
        <input
          id="ship-fullName"
          type="text"
          value={form.fullName}
          onChange={e => set('fullName', e.target.value)}
          autoComplete="name"
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t('fields.email')} required>
          <input
            id="ship-email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
        <Field label={t('fields.phone')} required>
          <input
            id="ship-phone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t('fields.country')} required>
        <CountrySelect id="ship-country" value={form.country} onChange={code => set('country', code)} />
      </Field>

      <Field label={t('fields.street')} required>
        <input
          id="ship-street"
          type="text"
          value={form.street}
          onChange={e => set('street', e.target.value)}
          autoComplete="street-address"
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label={t('fields.city')} required>
          <input
            id="ship-city"
            type="text"
            value={form.city}
            onChange={e => set('city', e.target.value)}
            autoComplete="address-level2"
            className={inputClass}
          />
        </Field>
        <Field label={t('fields.stateProvince')}>
          <input
            type="text"
            value={form.stateProvince}
            onChange={e => set('stateProvince', e.target.value)}
            autoComplete="address-level1"
            className={inputClass}
          />
        </Field>
        <Field label={t('fields.postalCode')} required>
          <input
            id="ship-postalCode"
            type="text"
            value={form.postalCode}
            onChange={e => set('postalCode', e.target.value)}
            autoComplete="postal-code"
            className={inputClass}
          />
        </Field>
      </div>

      {showFedex && (
        <Field label={t('fields.fedexAccount')} hint={t('fields.fedexHint')}>
          <input
            type="text"
            value={form.fedexAccount}
            onChange={e => set('fedexAccount', e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      <Field label={t('fields.notes')} hint={t('fields.notesHint')}>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          maxLength={500}
          rows={4}
          placeholder={t('fields.notesPlaceholder')}
          className={`${inputClass} resize-y min-h-[96px]`}
        />
      </Field>

      <Field label={t('fields.discountCode')} hint={t('fields.discountCodeHint')}>
        <input
          type="text"
          value={form.discountCode}
          onChange={e => set('discountCode', e.target.value)}
          maxLength={64}
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      {error && (
        <p className="text-sm text-red-600 -mb-2" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-gold w-full">
        {t('shipping.continue')}
      </button>
    </form>
  );
}

const inputClass =
  'w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors';

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
        {label}
        {required && <span className="text-gold-dark ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-mist mt-1.5">{hint}</p>}
    </div>
  );
}
