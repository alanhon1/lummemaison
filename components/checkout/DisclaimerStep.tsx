'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { readDraft, writeDraft } from '@/lib/checkout/state';

const KEYS = ['shipping', 'delivery', 'stock'] as const;
type Key = (typeof KEYS)[number];

const ICONS: Record<Key, string> = { shipping: '📦', delivery: '⏱', stock: '📋' };

export default function DisclaimerStep() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const [checked, setChecked] = useState<Record<Key, boolean>>({
    shipping: false,
    delivery: false,
    stock: false,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = readDraft();
    if (!draft.shipping) {
      router.replace(`/${locale}/checkout/shipping`);
      return;
    }
    if (draft.disclaimers) {
      setChecked({
        shipping: draft.disclaimers.shipping,
        delivery: draft.disclaimers.delivery,
        stock: draft.disclaimers.stock,
      });
    }
    setHydrated(true);
  }, [locale, router]);

  const allChecked = checked.shipping && checked.delivery && checked.stock;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) return;
    writeDraft({
      disclaimers: {
        shipping: true,
        delivery: true,
        stock: true,
        acceptedAt: new Date().toISOString(),
      },
    });
    router.push(`/${locale}/checkout/payment`);
  }

  if (!hydrated) {
    return <div className="text-sm text-mist">{t('loading')}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        {KEYS.map(key => (
          <article
            key={key}
            className="bg-white border border-bone rounded-lg p-5 md:p-6"
          >
            <header className="flex items-center gap-2 mb-3">
              <span aria-hidden className="text-base">{ICONS[key]}</span>
              <h3 className="font-display italic text-lg md:text-xl text-charcoal">
                {t(`disclaimers.${key}.heading`)}
              </h3>
            </header>
            <div className="h-px w-12 bg-gold-dark mb-3" aria-hidden />
            {t(`disclaimers.${key}.body`)
              .split('\n\n')
              .map((para, i) => (
                <p key={i} className="text-sm text-mist mb-3 last:mb-0 whitespace-pre-line">
                  {para}
                </p>
              ))}
          </article>
        ))}
      </div>

      <label className="flex items-start gap-3 bg-white border border-bone rounded-lg p-5">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={e => {
            const v = e.target.checked;
            setChecked({ shipping: v, delivery: v, stock: v });
          }}
          className="mt-0.5 w-4 h-4 accent-gold"
        />
        <span className="text-sm text-charcoal">{t('disclaimers.acceptAll')}</span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/checkout/shipping`)}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
        >
          {t('back')}
        </button>
        <button type="submit" disabled={!allChecked} className="btn-gold disabled:opacity-50">
          {t('disclaimers.continue')}
        </button>
      </div>
    </form>
  );
}
