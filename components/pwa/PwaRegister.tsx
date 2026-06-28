'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    const clear = () => {
      navigator.clearAppBadge?.().catch?.(() => {});
    };
    clear();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') clear();
    });
  }, []);

  return null;
}
