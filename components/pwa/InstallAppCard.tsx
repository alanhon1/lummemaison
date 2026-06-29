'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Download, Share, Smartphone } from 'lucide-react';
import { useInstallPrompt } from './useInstallPrompt';

// Permanent install entry point for the Account page (so the app is findable even
// after the banner is dismissed). Hidden once the app is installed (standalone).
export default function InstallAppCard() {
  const t = useTranslations('pwa');
  const { mounted, standalone, isIOS, promptInstall } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!mounted || standalone) return null;

  async function onInstall() {
    if (isIOS) { setShowSteps(s => !s); return; }
    const r = await promptInstall();
    if (r === 'unavailable') setShowSteps(true);
  }

  const steps = isIOS
    ? [t('iosStep1'), t('iosStep2'), t('iosStep3')]
    : [t('androidStep1'), t('androidStep2')];

  return (
    <div className="rounded-xl border border-gold/30 bg-cream/60 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-gold/15 border border-gold/40">
          <Smartphone size={16} className="text-gold-dark" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-charcoal">{t('accountAppTitle')}</p>
          <p className="text-xs text-mist mt-0.5">{t('accountAppBody')}</p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showSteps && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-1.5 overflow-hidden text-xs text-charcoal"
          >
            <li className="flex items-center gap-2 text-gold-dark font-semibold tracking-wide">
              {isIOS ? <Share size={13} /> : <Download size={13} />}
              {t('installHowTitle')}
            </li>
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-dark">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>

      <button
        onClick={onInstall}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold text-charcoal text-xs font-semibold tracking-[0.15em] uppercase px-4 py-2 active:scale-[0.98] transition-transform"
      >
        {isIOS ? <Share size={14} /> : <Download size={14} />}
        {showSteps && isIOS ? t('installClose') : t('installCta')}
      </button>
    </div>
  );
}
