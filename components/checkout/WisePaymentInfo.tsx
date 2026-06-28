'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { WISE_PAYMENT, WISE_STEP_KEYS, WISE_IMAGES } from '@/lib/checkout/wisePayment';
import CopyButton from './CopyButton';

export default function WisePaymentInfo() {
  const t = useTranslations('checkout.wise');
  const allText = WISE_PAYMENT.bankFields.map(f => `${f.label}: ${f.value}`).join('\n');

  return (
    <article className="bg-white border border-bone rounded-lg p-5 md:p-6 hover-glow">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-dark mb-1">{t('kicker')}</p>
        <h2 className="font-display italic text-xl text-charcoal">{t('heading')}</h2>
      </header>
      <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />

      <ol className="mb-6 space-y-3">
        {WISE_STEP_KEYS.map((k, i) => (
          <li key={k} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-dark text-xs font-semibold text-white">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-charcoal">{t(`steps.${k}`)}</p>
          </li>
        ))}
      </ol>

      <div className="mb-6 rounded-md border border-bone bg-cream px-4 py-3 text-sm text-charcoal">
        {t('reason')}
      </div>

      <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">{t('screenshotsTitle')}</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {WISE_IMAGES.map(img => (
          <figure key={img.src} className="overflow-hidden rounded-md border border-bone bg-cream">
            <Image
              src={img.src}
              alt={t(img.captionKey)}
              width={270}
              height={570}
              className="aspect-[9/19] w-full object-cover"
            />
            <figcaption className="px-2 py-1.5 text-[11px] text-mist">{t(img.captionKey)}</figcaption>
          </figure>
        ))}
      </div>

      <div className="rounded-md border border-bone bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-charcoal">{t('bankTitle')}</h3>
          <CopyButton value={allText} ariaLabel={t('copyAll')} />
        </div>
        <dl className="divide-y divide-bone">
          {WISE_PAYMENT.bankFields.map(f => (
            <div key={f.label} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-mist">{f.label}</dt>
                <dd className={`text-sm text-charcoal ${f.mono ? 'font-mono break-all' : ''}`}>{f.value}</dd>
              </div>
              <CopyButton value={f.value} ariaLabel={`Copy ${f.label}`} />
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
