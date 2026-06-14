'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { readDraft, writeDraft } from '@/lib/checkout/state';
import { localePath } from '@/lib/i18n';
import { highlightField } from '@/lib/checkout/highlightField';

const KEYS = ['shipping', 'delivery', 'stock', 'temperatureSensitive', 'fragileItems'] as const;
type Key = (typeof KEYS)[number];

const ICONS: Record<Key, string> = {
  shipping: '📦',
  delivery: '⏱',
  stock: '📋',
  temperatureSensitive: '🌡',
  fragileItems: '🫙',
};

const EMPTY_CHECKED: Record<Key, boolean> = {
  shipping: false,
  delivery: false,
  stock: false,
  temperatureSensitive: false,
  fragileItems: false,
};

export default function DisclaimerStep() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const [checked, setChecked] = useState<Record<Key, boolean>>(EMPTY_CHECKED);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const checkboxRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    const draft = readDraft();
    if (!draft.shipping) {
      router.replace(localePath(locale, '/checkout/shipping'));
      return;
    }
    if (draft.disclaimers) {
      setChecked({
        shipping: draft.disclaimers.shipping,
        delivery: draft.disclaimers.delivery,
        stock: draft.disclaimers.stock,
        temperatureSensitive: draft.disclaimers.temperatureSensitive,
        fragileItems: draft.disclaimers.fragileItems,
      });
    }
    setHydrated(true);
  }, [locale, router]);

  const allChecked = KEYS.every(k => checked[k]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) {
      setError(t('disclaimers.mustAccept'));
      highlightField(checkboxRef.current);
      return;
    }
    setError('');
    writeDraft({
      disclaimers: {
        shipping: true,
        delivery: true,
        stock: true,
        temperatureSensitive: true,
        fragileItems: true,
        acceptedAt: new Date().toISOString(),
      },
    });
    router.push(localePath(locale, '/checkout/payment'));
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

      <label
        ref={checkboxRef}
        className="flex items-start gap-3 bg-white border border-bone rounded-lg p-5 cursor-pointer select-none [touch-action:manipulation]"
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={e => {
            const v = e.target.checked;
            setChecked({
              shipping: v,
              delivery: v,
              stock: v,
              temperatureSensitive: v,
              fragileItems: v,
            });
          }}
          className="mt-0.5 w-5 h-5 shrink-0 accent-gold cursor-pointer"
        />
        <span className="text-sm text-charcoal">{t('disclaimers.acceptAll')}</span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-end">
        {error && (
          <p className="text-xs text-red-600 sm:mr-auto" role="alert">{error}</p>
        )}
        <button
          type="button"
          onClick={() => router.push(localePath(locale, '/checkout/shipping'))}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors [touch-action:manipulation]"
        >
          {t('back')}
        </button>
        <button type="submit" className="btn-gold">
          {t('disclaimers.continue')}
        </button>
      </div>
    </form>
  );
}
