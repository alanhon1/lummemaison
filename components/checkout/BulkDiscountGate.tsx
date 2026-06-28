'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { requestBulkQuoteAction } from '@/app/[locale]/checkout/actions';

interface Props {
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  payload: string;
  onChoosePayNow: () => void;
  locale: string;
}

const usd = (c: number, l: string) =>
  (c / 100).toLocaleString(l, { style: 'currency', currency: 'USD' });

export default function BulkDiscountGate({
  subtotalCents,
  shippingCents,
  discountCents,
  payload,
  onChoosePayNow,
  locale,
}: Props) {
  const t = useTranslations('checkout.bulk');
  const [step, setStep] = useState<'popup' | 'options' | 'requesting' | 'done'>('popup');
  const [error, setError] = useState('');

  async function requestQuote() {
    setStep('requesting');
    setError('');
    const res = await requestBulkQuoteAction(payload);
    if (!res.ok) {
      setError(res.error ?? t('genericError'));
      setStep('options');
      return;
    }
    setStep('done');
  }

  /* ── Done: quote-requested confirmation ─────────────────────────── */
  if (step === 'done') {
    return (
      <div className="bg-white border border-gold/40 rounded-2xl p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-2xl">
          ✦
        </div>
        <h2 className="font-display italic text-xl text-charcoal mb-2">
          {t('quoteRequested.title')}
        </h2>
        <p className="text-sm text-mist leading-relaxed">{t('quoteRequested.body')}</p>
      </div>
    );
  }

  /* ── Popup: celebratory modal ────────────────────────────────────── */
  if (step === 'popup') {
    return (
      <div className="bg-white border border-gold/40 rounded-2xl p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-2xl">
          ✦
        </div>
        <h2 className="mb-2 font-display italic text-xl text-charcoal">
          {t('popup.title')}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-mist">
          {t('popup.body')}
        </p>
        <button
          onClick={() => setStep('options')}
          className="w-full rounded-xl bg-gold-dark py-3.5 font-medium text-white transition hover:bg-gold"
        >
          {t('popup.next')}
        </button>
      </div>
    );
  }

  /* ── Options: two-card chooser (also shown while requesting) ─────── */
  const optionATotal = subtotalCents + shippingCents;
  const discountedSubtotal = subtotalCents - discountCents;
  const isRequesting = step === 'requesting';

  return (
    <div className="space-y-4">
      <h2 className="text-center font-display italic text-lg text-charcoal">
        {t('optionsTitle')}
      </h2>

      {/* ─── Card A: Pay now (no discount) ─────────────────────────── */}
      <div className="rounded-2xl border border-bone bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-charcoal">{t('cardA.title')}</h3>
          <span className="rounded-full bg-bone px-2.5 py-1 text-[11px] font-medium text-mist">
            {t('cardA.badge')}
          </span>
        </div>
        <ul className="mb-4 space-y-1.5 text-sm text-mist">
          <li>• {t('cardA.noDiscount')}</li>
          <li>• {t('cardA.shipping', { amount: usd(shippingCents, locale) })}</li>
          <li className="pl-3 text-[11px] text-mist/70">{t('cardA.shippingNote')}</li>
          <li>• {t('cardA.payToday')}</li>
        </ul>
        <div className="mb-4 flex items-center justify-between border-t border-bone pt-3 text-sm">
          <span className="text-mist">{t('cardA.totalDueNow')}</span>
          <span className="text-lg font-semibold text-charcoal">
            {usd(optionATotal, locale)}
          </span>
        </div>
        <button
          onClick={onChoosePayNow}
          disabled={isRequesting}
          className="w-full rounded-xl bg-charcoal py-3 font-medium text-white transition hover:bg-charcoal/80 disabled:opacity-50"
        >
          {t('cardA.cta')}
        </button>
      </div>

      {/* ─── Card B: 15% off / team quote ──────────────────────────── */}
      <div className="rounded-2xl border-2 border-gold bg-gold/5 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-charcoal">{t('cardB.title')}</h3>
          <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[11px] font-semibold text-gold-dark">
            {t('cardB.discountBadge', { amount: usd(discountCents, locale) })}
          </span>
        </div>
        <ul className="mb-4 space-y-1.5 text-sm text-charcoal/80">
          <li>• {t('cardB.discount15')}</li>
          <li>• {t('cardB.shippingQuoted')}</li>
          <li>• {t('cardB.payLater')}</li>
        </ul>
        <div className="mb-4 space-y-1 border-t border-gold/30 pt-3 text-sm">
          <div className="flex justify-between text-mist">
            <span>{t('cardB.productAfterDiscount')}</span>
            <span>{usd(discountedSubtotal, locale)}</span>
          </div>
          <div className="flex justify-between text-mist">
            <span>{t('cardB.shipping')}</span>
            <span>{t('cardB.shippingValue')}</span>
          </div>
          <div className="flex justify-between pt-1 font-semibold text-charcoal">
            <span>{t('cardB.dueNow')}</span>
            <span>{usd(0, locale)}</span>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={requestQuote}
          disabled={isRequesting}
          className="w-full rounded-xl bg-gold-dark py-3 font-medium text-white transition hover:bg-gold disabled:opacity-60"
        >
          {isRequesting ? t('requesting') : t('cardB.cta')}
        </button>
      </div>
    </div>
  );
}
