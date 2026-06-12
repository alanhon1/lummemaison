'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'lumee_disclaimer_agreed';
const EXIT_URL = 'https://www.google.com';

const SECTION_KEYS = ['products', 'noMedicalAdvice', 'reship', 'refund', 'shipping'] as const;

export default function DisclaimerModal() {
  const t = useTranslations('disclaimer');
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [dismissed, setDismissed] = useState(false);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable — show modal this session
    }
  }, []);

  const open = mounted && !dismissed;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  function handleUnderstand() {
    setStep(2);
  }

  function handleExit() {
    window.location.replace(EXIT_URL);
  }

  function handleAgree() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore — best effort
    }
    setDismissed(true);
    // Let the announcement popup know it may now appear (no first-visit overlap).
    try {
      window.dispatchEvent(new Event('lumee:disclaimer-agreed'));
    } catch {
      // ignore — best effort
    }
  }

  function handleDecline() {
    window.location.replace(EXIT_URL);
  }

  const titleId = `disclaimer-step${step}-title`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
      style={{ background: 'rgba(10, 10, 10, 0.72)', backdropFilter: 'blur(2px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        // max-h uses dvh (dynamic viewport height) NOT vh: on iOS Safari `vh`
        // is measured with the address bar hidden, so 92vh was taller than the
        // actually-visible area and pushed the bottom buttons off-screen. The
        // scrollable text below is flex-1/min-h-0 and the buttons are shrink-0,
        // so the Agree/Continue buttons are ALWAYS visible regardless of height.
        className="w-full max-w-xl rounded-2xl p-6 md:p-10 max-h-[92dvh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          boxShadow: 'var(--accent-glow), 0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        {step === 1 ? (
          <Step1 titleId={titleId} primaryRef={primaryRef} onUnderstand={handleUnderstand} onExit={handleExit} t={t} />
        ) : (
          <Step2 titleId={titleId} primaryRef={primaryRef} onAgree={handleAgree} onDecline={handleDecline} t={t} />
        )}
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function Step1({
  titleId,
  primaryRef,
  onUnderstand,
  onExit,
  t,
}: {
  titleId: string;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  onUnderstand: () => void;
  onExit: () => void;
  t: T;
}) {
  return (
    <>
      <h2
        id={titleId}
        className="shrink-0 font-display italic text-2xl md:text-3xl font-light"
        style={{ color: 'var(--page-text)' }}
      >
        {t('step1.title')}
      </h2>
      <div className="gold-divider shrink-0" />

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <p className="text-sm md:text-base mb-4" style={{ color: 'var(--page-text-2)' }}>
          {t('step1.intro')}
        </p>

        <p
          className="text-xs md:text-sm font-semibold tracking-wide uppercase mb-3"
          style={{ color: 'var(--page-text)' }}
        >
          {t('step1.confirmHeading')}
        </p>

        <ul className="space-y-2 mb-2">
          {(['age', 'injectables', 'homecare'] as const).map(key => (
            <li key={key} className="flex gap-3 text-sm md:text-base" style={{ color: 'var(--page-text)' }}>
              <span aria-hidden style={{ color: 'var(--accent)' }} className="font-semibold mt-0.5">
                ✓
              </span>
              <span>{t(`step1.confirm.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onExit}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md transition-colors"
          style={{
            border: '1px solid var(--border-color)',
            color: 'var(--page-text-2)',
            background: 'transparent',
          }}
        >
          {t('step1.cta.exit')}
        </button>
        <button
          ref={primaryRef}
          type="button"
          onClick={onUnderstand}
          className="btn-gold"
        >
          {t('step1.cta.understand')}
        </button>
      </div>
    </>
  );
}

function Step2({
  titleId,
  primaryRef,
  onAgree,
  onDecline,
  t,
}: {
  titleId: string;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  onAgree: () => void;
  onDecline: () => void;
  t: T;
}) {
  return (
    <>
      <h2
        id={titleId}
        className="shrink-0 font-display italic text-2xl md:text-3xl font-light"
        style={{ color: 'var(--page-text)' }}
      >
        {t('step2.title')}
      </h2>
      <div className="gold-divider shrink-0" />

      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {SECTION_KEYS.map(key => (
          <section key={key} className="mb-6 last:mb-2">
            <h3
              className="font-display italic text-lg md:text-xl mb-2 flex items-center gap-2"
              style={{ color: 'var(--page-text)' }}
            >
              <span aria-hidden>{t(`step2.section.${key}.icon`)}</span>
              <span>{t(`step2.section.${key}.heading`)}</span>
            </h3>
            <div
              className="h-px w-12 mb-3"
              style={{ background: 'var(--accent)' }}
              aria-hidden
            />
            {t(`step2.section.${key}.body`)
              .split('\n\n')
              .map((para, i) => (
                <p
                  key={i}
                  className="text-sm md:text-base mb-3 last:mb-0 whitespace-pre-line"
                  style={{ color: 'var(--page-text-2)' }}
                >
                  {para}
                </p>
              ))}
          </section>
        ))}

        <p
          className="text-sm md:text-base font-semibold mt-6"
          style={{ color: 'var(--page-text)' }}
        >
          {t('step2.finalLine')}
        </p>
      </div>

      <div className="shrink-0 mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onDecline}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md transition-colors"
          style={{
            border: '1px solid var(--border-color)',
            color: 'var(--page-text-2)',
            background: 'transparent',
          }}
        >
          {t('step2.cta.decline')}
        </button>
        <button
          ref={primaryRef}
          type="button"
          onClick={onAgree}
          className="btn-gold"
        >
          {t('step2.cta.agree')}
        </button>
      </div>
    </>
  );
}
