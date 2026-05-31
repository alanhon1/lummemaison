'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { readDraft, computeShippingCents, type CheckoutDraft } from '@/lib/checkout/state';
import { useCartStore } from '@/lib/store';
import { placeOrderAction } from '@/app/[locale]/checkout/actions';

interface PaymentInfo {
  wise: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    swift: string;
  };
  usdt: {
    address: string;
    network: string;
  };
  adminEmail: string;
}

interface Props {
  payment: PaymentInfo;
  serverError?: string;
}

function formatUSD(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function PaymentStep({ payment, serverError }: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const { items } = useCartStore();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d.shipping || !d.disclaimers) {
      router.replace(`/${locale}/checkout/shipping`);
      return;
    }
    setDraft(d);
  }, [locale, router]);

  if (!draft || !draft.shipping || !draft.disclaimers) {
    return <div className="text-sm text-mist">{t('loading')}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="bg-white border border-bone rounded-lg p-8 text-center">
        <p className="font-display text-xl text-charcoal mb-3">{t('emptyCart.title')}</p>
        <p className="text-sm text-mist mb-6">{t('emptyCart.subtitle')}</p>
        <button onClick={() => router.push(`/${locale}/catalogue`)} className="btn-gold">
          {t('emptyCart.cta')}
        </button>
      </div>
    );
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
    0,
  );
  const shippingCents = computeShippingCents(draft.shipping);
  const totalCents = subtotalCents + shippingCents;

  const payload = JSON.stringify({
    locale,
    shipping: draft.shipping,
    disclaimers: draft.disclaimers,
    items: items.map(i => ({
      product_id: i.id,
      product_name: i.name,
      unit_cents: Math.round(i.price * 100),
      quantity: i.quantity,
    })),
  });

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <h2 className="font-display italic text-xl text-charcoal mb-4">{t('payment.summary')}</h2>
        <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
          {items.map(i => (
            <li key={i.id} className="flex justify-between text-sm">
              <span className="text-charcoal line-clamp-1 pr-3">
                {i.name} <span className="text-mist">× {i.quantity}</span>
              </span>
              <span className="text-charcoal whitespace-nowrap">
                {formatUSD(Math.round(i.price * 100) * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-bone pt-3 space-y-1.5 text-sm">
          <Row label={t('payment.subtotal')} value={formatUSD(subtotalCents)} />
          <Row
            label={t('payment.shipping')}
            value={formatUSD(shippingCents)}
            hint={shippingCents === 6500 ? t('payment.shippingUsaNoFedex') : t('payment.shippingFlat')}
          />
          <Row label={t('payment.total')} value={formatUSD(totalCents)} strong />
        </div>
      </div>

      {/* Wise */}
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <header className="flex items-center gap-2 mb-4">
          <span aria-hidden>💳</span>
          <h2 className="font-display italic text-xl text-charcoal">{t('payment.wise.heading')}</h2>
        </header>
        <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />
        <dl className="space-y-2 text-sm">
          <PaymentRow label={t('payment.wise.accountName')} value={payment.wise.accountName} copyKey="wise-name" copied={copied} onCopy={copy} />
          <PaymentRow label={t('payment.wise.bank')} value={payment.wise.bankName} copyKey="wise-bank" copied={copied} onCopy={copy} />
          <PaymentRow label={t('payment.wise.accountNumber')} value={payment.wise.accountNumber} copyKey="wise-account" copied={copied} onCopy={copy} mono />
          <PaymentRow label={t('payment.wise.swift')} value={payment.wise.swift} copyKey="wise-swift" copied={copied} onCopy={copy} mono />
        </dl>
      </article>

      {/* USDT */}
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <header className="flex items-center gap-2 mb-4">
          <span aria-hidden>💰</span>
          <h2 className="font-display italic text-xl text-charcoal">{t('payment.usdt.heading')}</h2>
        </header>
        <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />
        <dl className="space-y-2 text-sm">
          <PaymentRow label={t('payment.usdt.network')} value={payment.usdt.network} copyKey="usdt-net" copied={copied} onCopy={copy} />
          <PaymentRow label={t('payment.usdt.address')} value={payment.usdt.address} copyKey="usdt-addr" copied={copied} onCopy={copy} mono />
        </dl>
        <p className="text-xs text-mist mt-3">{t('payment.usdt.note')}</p>
      </article>

      <p className="text-sm text-mist bg-cream border border-bone rounded-md p-4">
        {t('payment.confirmNote', { email: payment.adminEmail })}
      </p>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {serverError}
        </p>
      )}

      <form
        action={async fd => {
          setSubmitting(true);
          await placeOrderAction(fd);
        }}
        className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="payload" value={payload} />
        <button
          type="button"
          onClick={() => router.push(`/${locale}/checkout/disclaimers`)}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
        >
          {t('back')}
        </button>
        <button type="submit" disabled={submitting} className="btn-gold disabled:opacity-60">
          {submitting ? t('payment.submitting') : t('payment.confirm')}
        </button>
      </form>
    </div>
  );
}

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <span className={strong ? 'text-charcoal font-semibold tracking-wider uppercase text-xs' : 'text-mist'}>
          {label}
        </span>
        {hint && <p className="text-[11px] text-mist">{hint}</p>}
      </div>
      <span className={strong ? 'font-display text-xl text-charcoal' : 'text-charcoal'}>
        {value}
      </span>
    </div>
  );
}

function PaymentRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <dt className="text-xs text-mist tracking-wider uppercase whitespace-nowrap">{label}</dt>
      <dd className={`text-charcoal text-sm ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
      <button
        type="button"
        onClick={() => onCopy(value, copyKey)}
        className="text-mist hover:text-gold-dark p-1.5 rounded-md transition-colors"
        aria-label="Copy"
      >
        {copied === copyKey ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
