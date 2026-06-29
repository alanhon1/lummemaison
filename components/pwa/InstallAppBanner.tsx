'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { X, Download, Share, Bell } from 'lucide-react';
import { useInstallPrompt } from './useInstallPrompt';

const DISMISS_KEY = 'lumee-install-dismissed';

// Mobile-only, dismissible slide-up banner that tells customers the app exists
// and can push new-arrival alerts. Hidden when already installed (standalone),
// on desktop, or once dismissed. Android gets a native install button; iOS (and
// any browser without a captured prompt) expands manual Home-Screen steps.
export default function InstallAppBanner() {
  const t = useTranslations('pwa');
  const { mounted, standalone, isIOS, canPrompt, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  // Hold the banner back a few seconds so it doesn't slam the page on first paint
  // — let the customer glance at the page first, then slide it up.
  const [delayPassed, setDelayPassed] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); }
    setIsMobile(window.matchMedia('(max-width: 820px)').matches);
    const timer = setTimeout(() => setDelayPassed(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || standalone || dismissed || !isMobile || !delayPassed) return null;

  function close() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  }

  async function onInstall() {
    if (isIOS) { setShowSteps(s => !s); return; } // toggle the Home-Screen steps
    const r = await promptInstall();
    if (r === 'accepted') close();
    else if (r === 'unavailable') setShowSteps(true); // Android criteria not ready → manual
  }

  const steps = isIOS
    ? [t('iosStep1'), t('iosStep2'), t('iosStep3')]
    : [t('androidStep1'), t('androidStep2')];

  return (
    <AnimatePresence>
      <motion.div
        key="install-banner"
        initial={{ y: 140, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 140, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="fixed inset-x-3 z-40 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
        role="dialog"
        aria-label={t('installTitle')}
      >
        <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-charcoal text-cream shadow-2xl">
          {/* Gold sheen sweep */}
          <motion.div
            aria-hidden
            initial={{ x: '-120%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-gold/25 to-transparent"
          />
          <div className="relative p-4">
            <button
              onClick={close}
              aria-label={t('installLater')}
              className="absolute top-2.5 right-2.5 text-cream/60 hover:text-cream"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <motion.div
                initial={{ scale: 0.8, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                className="shrink-0 mt-0.5 grid place-items-center w-10 h-10 rounded-xl bg-gold/15 border border-gold/40"
              >
                <Bell size={18} className="text-gold" />
              </motion.div>
              <div className="min-w-0">
                <p className="font-display text-lg leading-tight text-cream">{t('installTitle')}</p>
                <p className="text-xs text-cream/70 mt-0.5">{t('installBody')}</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showSteps && (
                <motion.ol
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-1.5 overflow-hidden text-xs text-cream/85"
                >
                  <li className="flex items-center gap-2 text-gold">
                    {isIOS ? <Share size={13} /> : <Download size={13} />}
                    <span className="font-semibold tracking-wide">{t('installHowTitle')}</span>
                  </li>
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold/80">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>

            <div className="mt-3.5 flex items-center gap-3">
              <button
                onClick={onInstall}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gold text-charcoal text-xs font-semibold tracking-[0.15em] uppercase py-2.5 active:scale-[0.98] transition-transform"
              >
                {isIOS ? <Share size={14} /> : <Download size={14} />}
                {showSteps && isIOS ? t('installClose') : t('installCta')}
              </button>
              <button onClick={close} className="text-xs text-cream/60 hover:text-cream px-1">
                {t('installLater')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
