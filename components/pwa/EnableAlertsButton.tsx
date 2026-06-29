'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { subscribeToPush, unsubscribeFromPush, getPushState } from './pushClient';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export default function EnableAlertsButton() {
  const t = useTranslations('pwa');
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [sub, setSub] = useState<'loading' | 'on' | 'off' | 'unsupported'>('loading');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<'' | 'denied' | 'error'>('');

  useEffect(() => {
    setMounted(true);
    const mm = window.matchMedia('(display-mode: standalone)').matches;
    const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isStandalone = mm || ios;
    setStandalone(isStandalone);
    if (isStandalone) {
      getPushState().then(s => setSub(s === 'on' ? 'on' : s === 'unsupported' ? 'unsupported' : 'off'));
    }
  }, []);

  if (!mounted || !VAPID) return null;
  if (!standalone) return <p className="text-xs text-mist">{t('iosHint')}</p>;
  if (sub === 'loading') return null;
  if (sub === 'unsupported') return <p className="text-xs text-mist">{t('unsupported')}</p>;

  async function enable() {
    setBusy(true); setErr('');
    const r = await subscribeToPush(VAPID);
    setBusy(false);
    if (r === 'ok') setSub('on');
    else setErr(r === 'denied' ? 'denied' : 'error');
  }

  async function disable() {
    setBusy(true); setErr('');
    await unsubscribeFromPush();
    setBusy(false);
    setSub('off');
  }

  if (sub === 'on') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-gold-dark">{t('enabled')}</span>
        <button onClick={disable} disabled={busy} className="text-xs text-mist underline hover:text-charcoal disabled:opacity-50">
          {busy ? t('disabling') : t('disableAlerts')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button onClick={enable} disabled={busy} className="btn-gold text-xs">
        {busy ? t('enabling') : t('enableAlerts')}
      </button>
      {err === 'denied' && <p className="text-xs text-red-600">{t('denied')}</p>}
      {err === 'error' && <p className="text-xs text-red-600">{t('error')}</p>}
    </div>
  );
}
