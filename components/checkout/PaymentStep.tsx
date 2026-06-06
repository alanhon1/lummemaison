'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, MessageCircle, FileCheck2, Loader2 } from 'lucide-react';
import { readDraft, computeShippingCents, type CheckoutDraft } from '@/lib/checkout/state';
import { useCartStore } from '@/lib/store';
import { placeOrderAction, uploadPaymentProof } from '@/app/[locale]/checkout/actions';
import { localePath } from '@/lib/i18n';
import CopyButton from './CopyButton';

const ACCEPTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export interface PaymentInfo {
  wise: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    swift: string;
    address: string;
    city: string;
    country: string;
    postcode: string;
    currency: string;
  };
  usdt: {
    networks: Array<{ id: string; label: string; address: string }>;
    whatsapp: string;
  };
  adminEmail: string;
}

interface Props {
  payment: PaymentInfo;
  serverError?: string;
}

function formatUSD(cents: number, locale: string) {
  return (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'USD' });
}

export default function PaymentStep({ payment, serverError }: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const { items } = useCartStore();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [proofPath, setProofPath] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [transactionLink, setTransactionLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d.shipping || !d.disclaimers) {
      router.replace(localePath(locale, '/checkout/shipping'));
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
        <button onClick={() => router.push(localePath(locale, '/catalogue'))} className="btn-gold">
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
    paymentProofPath: proofPath || undefined,
    paymentTransactionLink: transactionLink.trim() || undefined,
  });

  const confirmEnabled = !submitting && (!!proofPath || transactionLink.trim().length > 0);

  async function handleFile(file: File) {
    setUploadError('');
    if (file.size > MAX_PROOF_BYTES) {
      setUploadError(t('payment.proof.errors.tooLarge'));
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      setUploadError(t('payment.proof.errors.wrongType'));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await uploadPaymentProof(fd);
      if (!res.ok || !res.path) {
        setUploadError(res.error ?? t('payment.proof.errors.generic'));
        return;
      }
      setProofPath(res.path);
      setProofFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  function clearProof() {
    setProofPath('');
    setProofFileName('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Build the visible Wise fields list — env-driven, so unconfigured fields
  // simply disappear instead of leaking "[pending]" text. Order matches the
  // order a customer would fill in a Wise transfer form.
  const wiseFields: Array<{ key: string; label: string; value: string; mono?: boolean }> = [
    { key: 'wise-name', label: t('payment.wise.accountName'), value: payment.wise.accountName },
    { key: 'wise-bank', label: t('payment.wise.bank'), value: payment.wise.bankName },
    { key: 'wise-account', label: t('payment.wise.accountNumber'), value: payment.wise.accountNumber, mono: true },
    { key: 'wise-swift', label: t('payment.wise.swift'), value: payment.wise.swift, mono: true },
    { key: 'wise-currency', label: t('payment.wise.currency'), value: payment.wise.currency },
    { key: 'wise-address', label: t('payment.wise.address'), value: payment.wise.address },
    { key: 'wise-city', label: t('payment.wise.city'), value: payment.wise.city },
    { key: 'wise-postcode', label: t('payment.wise.postcode'), value: payment.wise.postcode },
    { key: 'wise-country', label: t('payment.wise.country'), value: payment.wise.country },
  ].filter(f => f.value);

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
                {formatUSD(Math.round(i.price * 100) * i.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-bone pt-3 space-y-1.5 text-sm">
          <Row label={t('payment.subtotal')} value={formatUSD(subtotalCents, locale)} />
          <Row
            label={t('payment.shipping')}
            value={formatUSD(shippingCents, locale)}
            hint={shippingCents === 6500 ? t('payment.shippingUsaNoFedex') : t('payment.shippingFlat')}
          />
          <Row label={t('payment.total')} value={formatUSD(totalCents, locale)} strong />
        </div>
      </div>

      {/* Wise */}
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6 hover-glow">
        <header className="flex items-center gap-2 mb-4">
          <span aria-hidden>💳</span>
          <h2 className="font-display italic text-xl text-charcoal">{t('payment.wise.heading')}</h2>
        </header>
        <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />

        <div className="bg-cream border border-bone rounded-md p-4 mb-5 text-sm text-charcoal leading-relaxed space-y-2">
          <p>{t('payment.wise.warnings.creditCard')}</p>
          <p>{t('payment.wise.warnings.recommended')}</p>
          <p>{t('payment.wise.warnings.businessGoods')}</p>
          <p>{t('payment.wise.warnings.directEntry')}</p>
          <p>{t('payment.wise.warnings.feesAtSender')}</p>
        </div>

        <div className="bg-gold/10 border border-gold-dark/40 rounded-md p-4 mb-5 text-sm text-charcoal">
          <p className="font-semibold tracking-wider uppercase text-xs text-gold-dark mb-1">
            {t('payment.wise.reference.label')}
          </p>
          <p>{t('payment.wise.reference.body')}</p>
        </div>

        {wiseFields.length === 0 ? (
          <p className="text-sm text-mist italic">{t('payment.wise.notConfigured')}</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {wiseFields.map(f => (
              <PaymentRow key={f.key} label={f.label} value={f.value} mono={f.mono} />
            ))}
          </dl>
        )}
      </article>

      {/* USDT */}
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6 hover-glow">
        <header className="flex items-center gap-2 mb-4">
          <span aria-hidden>💰</span>
          <h2 className="font-display italic text-xl text-charcoal tracking-wider">
            {t('payment.usdt.heading')}
          </h2>
        </header>
        <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />

        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-5 text-sm text-red-700 space-y-2">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{t('payment.usdt.warnings.noBtc')}</span>
          </p>
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{t('payment.usdt.warnings.networkOnly')}</span>
          </p>
        </div>

        <div className="bg-cream border border-bone rounded-md p-4 mb-5 text-sm text-charcoal leading-relaxed">
          <p className="font-semibold mb-1">{t('payment.usdt.testFirst.label')}</p>
          <p>{t('payment.usdt.testFirst.body')}</p>
        </div>

        {payment.usdt.networks.length === 0 ? (
          <p className="text-sm text-mist italic">{t('payment.usdt.noNetworks')}</p>
        ) : (
          <dl className="space-y-3 text-sm">
            {payment.usdt.networks.map(n => (
              <div key={n.id} className="border border-bone rounded-md p-3 space-y-2">
                <div className="text-xs tracking-wider uppercase text-mist">
                  {t('payment.usdt.network')}: <span className="text-charcoal font-semibold">{n.label}</span>
                </div>
                <PaymentRow label={t('payment.usdt.address')} value={n.address} mono />
              </div>
            ))}
          </dl>
        )}

        {payment.usdt.whatsapp && (
          <div className="mt-5 bg-cream border border-bone rounded-md p-4 text-sm text-charcoal flex items-start gap-2">
            <MessageCircle size={18} className="mt-0.5 shrink-0 text-gold-dark" aria-hidden />
            <div>
              <p className="font-semibold mb-0.5">{t('payment.usdt.whatsapp.label')}</p>
              <p className="font-mono">{payment.usdt.whatsapp}</p>
            </div>
          </div>
        )}
      </article>

      {/* Payment proof — gating */}
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <header className="flex items-center gap-2 mb-2">
          <FileCheck2 size={20} className="text-gold-dark" aria-hidden />
          <h2 className="font-display italic text-xl text-charcoal">{t('payment.proof.heading')}</h2>
        </header>
        <p className="text-sm text-mist mb-5">{t('payment.proof.subheading')}</p>

        <div className="space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
              {t('payment.proof.fileLabel')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-sm text-charcoal file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:tracking-widest file:uppercase file:bg-gold-dark/10 file:text-gold-dark hover:file:bg-gold-dark/20 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-mist mt-1.5">{t('payment.proof.fileHint')}</p>

            {uploading && (
              <p className="text-xs text-mist mt-2 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                {t('payment.proof.uploading')}
              </p>
            )}
            {proofPath && !uploading && (
              <div className="mt-2 flex items-center gap-3 bg-cream border border-bone rounded-md px-3 py-2">
                <FileCheck2 size={16} className="text-gold-dark shrink-0" aria-hidden />
                <span className="text-sm text-charcoal truncate flex-1">
                  {t('payment.proof.uploaded', { name: proofFileName })}
                </span>
                <button
                  type="button"
                  onClick={clearProof}
                  className="text-xs text-mist hover:text-gold-dark underline underline-offset-4"
                >
                  {t('payment.proof.replace')}
                </button>
              </div>
            )}
            {uploadError && (
              <p className="text-sm text-red-600 mt-2 flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                {uploadError}
              </p>
            )}
          </div>

          <div className="text-xs tracking-wider uppercase text-mist text-center">
            {t('payment.proof.or')}
          </div>

          {/* Transaction link */}
          <div>
            <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
              {t('payment.proof.transactionLabel')}
            </label>
            <input
              type="url"
              value={transactionLink}
              onChange={e => setTransactionLink(e.target.value)}
              placeholder={t('payment.proof.transactionPlaceholder')}
              maxLength={500}
              className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
            />
            <p className="text-xs text-mist mt-1.5">{t('payment.proof.transactionHint')}</p>
          </div>

          {!confirmEnabled && !submitting && (
            <p className="text-xs text-mist italic">{t('payment.proof.requireEither')}</p>
          )}
        </div>
      </article>

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
          onClick={() => router.push(localePath(locale, '/checkout/disclaimers'))}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
        >
          {t('back')}
        </button>
        <button type="submit" disabled={!confirmEnabled} className="btn-gold disabled:opacity-60">
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
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <dt className="text-xs text-mist tracking-wider uppercase whitespace-nowrap">{label}</dt>
      <dd className={`text-charcoal text-sm ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
      <CopyButton value={value} ariaLabel={`Copy ${label}`} />
    </div>
  );
}
