'use client';

import { useEffect, useState } from 'react';

// Shared PWA install state for the customer app. Captures Chrome/Android's
// `beforeinstallprompt` so we can offer a native install button, detects iOS
// (which has no such event — manual "Add to Home Screen" only), and tracks
// whether we're already running as an installed app (standalone).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  // Assume installed until mounted so nothing flashes during SSR/hydration.
  const [standalone, setStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    const mm = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(mm || iosStandalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onBIP = (e: Event) => {
      e.preventDefault(); // keep Chrome's mini-infobar from showing; we drive it
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setStandalone(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Triggers the native Android/Chrome install dialog. Returns 'unavailable'
  // when there's no captured event (iOS, or criteria not yet met) so the caller
  // can fall back to manual instructions.
  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }

  return { mounted, standalone, isIOS, canPrompt: !!deferred, promptInstall };
}
