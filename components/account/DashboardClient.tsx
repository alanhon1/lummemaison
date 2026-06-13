'use client';

import { useActionState, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronRight, ChevronLeft, Search, X } from 'lucide-react';
import { updateProfile, logout, resendConfirmation, checkEmailVerified, type FormState } from '@/app/[locale]/account/actions';
import { localePath } from '@/lib/i18n';
import CountrySelect from './CountrySelect';
import { findCountry, resolveCountryCode } from '@/lib/countries';
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
  email_verified: boolean;
}

interface OrderRow {
  id: number;
  order_number: string;
  order_seq: number | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  unread_message_count: number;
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
  const [country, setCountry] = useState(resolveCountryCode(profile.country));
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const showFedex = country === 'US';

  // Profile edits only persist when the user clicks Save. Track unsaved changes
  // so we can remind them, and clear the flag once a save succeeds. Clearing is
  // done by adjusting state during render (not an effect) when a new action
  // result arrives — see https://react.dev/learn/you-might-not-need-an-effect.
  const [dirty, setDirty] = useState(false);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.success) setDirty(false);
  }

  // Order history: search (by order number digits and/or date) + pagination.
  const PAGE_SIZE = 5;
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    return orders.filter(o => {
      if (digits) {
        const seqStr = o.order_seq != null ? String(o.order_seq).padStart(6, '0') : '';
        const numStr = o.order_number.replace(/\D/g, '');
        if (!seqStr.includes(digits) && !numStr.includes(digits)) return false;
      }
      if (dateFilter) {
        const d = new Date(o.created_at);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (local !== dateFilter) return false;
      }
      return true;
    });
  }, [orders, query, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilter = query.trim() !== '' || dateFilter !== '';

  function resetToFirstPage() {
    setPage(1);
  }

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

        {!profile.email_verified && <EmailNotConfirmedBanner email={email} locale={locale} />}

        <form action={formAction} onChange={() => setDirty(true)} className="space-y-4">
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
          {dirty ? (
            <p className="text-sm text-red-600">{t('dashboard.unsaved')}</p>
          ) : (
            state.success && <p className="text-sm text-gold-dark">{t('dashboard.saved')}</p>
          )}

          <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
            {pending ? t('dashboard.saving') : t('dashboard.save')}
          </button>
        </form>
      </section>

      {/* Order history */}
      <section>
        <div className="flex items-center justify-between mb-6 gap-3">
          <h2 className="font-display text-2xl text-charcoal">{t('dashboard.orderHistory')}</h2>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => { setSearchOpen(o => !o); if (searchOpen) { setQuery(''); setDateFilter(''); resetToFirstPage(); } }}
              aria-label="Search orders"
              className={`p-2 rounded-md border transition-colors ${searchOpen ? 'border-gold text-gold-dark' : 'border-bone text-mist hover:text-charcoal hover:border-gold/50'}`}
            >
              <Search size={16} />
            </button>
          )}
        </div>

        {searchOpen && orders.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 border border-bone rounded-md px-3 py-2 bg-white flex-1 focus-within:border-gold transition-colors">
              <Search size={13} className="text-mist shrink-0" />
              <input
                inputMode="numeric"
                value={query}
                onChange={e => { setQuery(e.target.value); resetToFirstPage(); }}
                placeholder="Order no. — e.g. 005001"
                className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
              />
              {query && (
                <button type="button" aria-label="Clear" onClick={() => { setQuery(''); resetToFirstPage(); }}>
                  <X size={13} className="text-mist hover:text-charcoal" />
                </button>
              )}
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); resetToFirstPage(); }}
              className="border border-bone rounded-md px-3 py-2 bg-white text-sm text-charcoal outline-none focus:border-gold transition-colors"
            />
            {hasFilter && (
              <button
                type="button"
                onClick={() => { setQuery(''); setDateFilter(''); resetToFirstPage(); }}
                className="text-xs text-mist hover:text-charcoal underline underline-offset-4 px-1 self-center"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {orders.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone rounded-md p-6 text-center">
            {t('dashboard.noOrders')}
          </p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone rounded-md p-6 text-center">
            No orders match your search.
          </p>
        ) : (
          <ul className="space-y-3">
            {pagedOrders.map(o => {
              const countryName = findCountry(profile.country)?.name ?? profile.country;
              const total = (o.total_cents / 100).toLocaleString(locale, {
                style: 'currency',
                currency: o.currency,
              });
              const detailSlug = o.order_seq != null ? String(o.order_seq) : encodeURIComponent(o.order_number);
              return (
                <li key={o.id}>
                  <Link
                    href={localePath(locale, `/account/orders/${detailSlug}`)}
                    className="block border border-bone rounded-md p-4 bg-white hover:border-gold transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg text-charcoal flex items-center gap-2">
                          {o.order_number}
                          {o.unread_message_count > 0 && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-cream text-[10px] font-semibold tabular-nums shadow"
                              aria-label={`${o.unread_message_count} new message${o.unread_message_count === 1 ? '' : 's'}`}
                              title={`${o.unread_message_count} new message${o.unread_message_count === 1 ? '' : 's'}`}
                            >
                              {o.unread_message_count}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-mist mt-0.5">
                          {new Date(o.created_at).toLocaleDateString()} · {countryName}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <OrderStatusBadge status={o.status} />
                          {o.unread_message_count > 0 && (
                            <span className="text-[10px] uppercase tracking-widest text-rose-700">
                              {t('newMessages', { count: o.unread_message_count })}
                            </span>
                          )}
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

        {/* Pagination — shown when more than one page of results */}
        {filteredOrders.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {pageWindow(safePage, totalPages).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-8 h-8 inline-flex items-center justify-center border rounded-md text-xs transition-colors ${
                  n === safePage ? 'border-gold bg-gold text-white' : 'border-bone text-charcoal hover:border-gold hover:text-gold-dark'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Windowed page numbers: up to 5 around the current page (e.g. 1 2 [3] 4 5).
function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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

// Shown to customers who signed up but never verified their email. Email
// confirmation is optional (they can use the account as-is), so this is an FYI
// + a one-click resend — not a hard gate.
function EmailNotConfirmedBanner({ email, locale }: { email: string; locale: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, {} as FormState);
  const [checking, setChecking] = useState(false);
  // null = not checked yet, true = confirmed, false = checked but still not confirmed.
  const [checkedVerified, setCheckedVerified] = useState<boolean | null>(null);

  async function handleCheck() {
    setChecking(true);
    try {
      const r = await checkEmailVerified();
      setCheckedVerified(r.verified);
    } finally {
      setChecking(false);
    }
  }

  // A re-check that comes back verified replaces the warning with a success note,
  // so a customer who just clicked the email link doesn't need to reload.
  if (checkedVerified === true) {
    return (
      <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">Email confirmed</p>
        <p className="mt-1 text-sm text-emerald-800">
          Thank you — your email address is verified. We can now reach you about your orders.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Your email isn&apos;t confirmed yet</p>
      <p className="mt-1 text-sm text-amber-800">
        We weren&apos;t able to verify your email address, so our team may be unable to reach you about
        your orders — shipping updates, payment confirmation, and similar. You can keep using your
        account as it is. If that&apos;s okay with you, no action is needed; otherwise, please confirm
        your email so we can stay in touch.
      </p>
      {state.success ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">
          Confirmation email sent. Please check your inbox (and your spam folder), then use
          “I&apos;ve confirmed — check now”.
        </p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs font-semibold uppercase tracking-widest rounded-md border border-amber-600 px-4 py-2 text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50 [touch-action:manipulation]"
          >
            {pending ? 'Sending…' : 'Resend confirmation email'}
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      )}

      {/* Re-check verification status (e.g. after clicking the email link in another tab). */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="text-xs font-semibold uppercase tracking-widest rounded-md border border-charcoal/30 px-4 py-2 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors disabled:opacity-50 [touch-action:manipulation]"
        >
          {checking ? 'Checking…' : "I've confirmed — check now"}
        </button>
        {checkedVerified === false && (
          <span className="text-xs text-amber-800">
            Still not confirmed. Click the link in the confirmation email (check spam too), then try again.
          </span>
        )}
      </div>
    </div>
  );
}
