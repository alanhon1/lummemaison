'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { updateProfile, logout, type FormState } from '@/app/[locale]/account/actions';
import CountrySelect from './CountrySelect';
import { findCountry } from '@/lib/countries';
import OrderStatusBadge from './OrderStatusBadge';

interface Profile {
  full_name: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  state_province: string | null;
  postal_code: string;
  fedex_account: string | null;
}

interface OrderRow {
  id: number;
  order_number: string;
  order_seq: number | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

const initialState: FormState = {};

export default function DashboardClient({
  email,
  profile,
  orders,
}: {
  email: string;
  profile: Profile;
  orders: OrderRow[];
}) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [country, setCountry] = useState(profile.country);
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const showFedex = country === 'US';

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
      {/* Profile + logout */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-charcoal">{t('dashboard.profile')}</h2>
          <form action={() => logout(locale)}>
            <button type="submit" className="text-xs text-mist hover:text-charcoal tracking-widest uppercase underline underline-offset-4">
              {t('dashboard.logout')}
            </button>
          </form>
        </div>

        <p className="text-sm text-mist mb-6">{email}</p>

        <form action={formAction} className="space-y-4">
          <Labelled label={t('fields.fullName')}>
            <input name="fullName" defaultValue={profile.full_name} required className={inputClass} />
          </Labelled>
          <Labelled label={t('fields.phone')}>
            <input name="phone" type="tel" defaultValue={profile.phone} required className={inputClass} />
          </Labelled>
          <Labelled label={t('fields.country')}>
            <CountrySelect value={country} onChange={setCountry} required />
          </Labelled>
          <Labelled label={t('fields.street')}>
            <input name="street" defaultValue={profile.street} required className={inputClass} />
          </Labelled>
          <div className="grid sm:grid-cols-3 gap-3">
            <Labelled label={t('fields.city')}>
              <input name="city" defaultValue={profile.city} required className={inputClass} />
            </Labelled>
            <Labelled label={t('fields.stateProvince')}>
              <input name="stateProvince" defaultValue={profile.state_province ?? ''} className={inputClass} />
            </Labelled>
            <Labelled label={t('fields.postalCode')}>
              <input name="postalCode" defaultValue={profile.postal_code} required className={inputClass} />
            </Labelled>
          </div>
          {showFedex && (
            <Labelled label={t('fields.fedexAccount')} hint={t('fields.fedexHint')}>
              <input name="fedexAccount" defaultValue={profile.fedex_account ?? ''} className={inputClass} />
            </Labelled>
          )}

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-gold-dark">{t('dashboard.saved')}</p>}

          <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
            {pending ? t('dashboard.saving') : t('dashboard.save')}
          </button>
        </form>
      </section>

      {/* Order history */}
      <section>
        <h2 className="font-display text-2xl text-charcoal mb-6">{t('dashboard.orderHistory')}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone rounded-md p-6 text-center">
            {t('dashboard.noOrders')}
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.map(o => {
              const countryName = findCountry(profile.country)?.name ?? profile.country;
              const total = (o.total_cents / 100).toLocaleString(locale, {
                style: 'currency',
                currency: o.currency,
              });
              const detailSlug = o.order_seq != null ? String(o.order_seq) : encodeURIComponent(o.order_number);
              return (
                <li key={o.id}>
                  <Link
                    href={`/${locale}/account/orders/${detailSlug}`}
                    className="block border border-bone rounded-md p-4 bg-white hover:border-gold transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg text-charcoal">{o.order_number}</p>
                        <p className="text-xs text-mist mt-0.5">
                          {new Date(o.created_at).toLocaleDateString()} · {countryName}
                        </p>
                        <div className="mt-2">
                          <OrderStatusBadge status={o.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right whitespace-nowrap">
                        <div>
                          <p className="font-display text-lg text-charcoal">{total}</p>
                          <p className="text-[10px] tracking-widest uppercase text-mist group-hover:text-gold-dark transition-colors">
                            {t('details')}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-mist group-hover:text-gold-dark transition-colors" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors';

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-mist mt-1.5">{hint}</p>}
    </div>
  );
}
