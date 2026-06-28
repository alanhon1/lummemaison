'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { subscribeToPush } from './pushClient';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export default function EnableAlertsButton() {
  const t = useTranslations('pwa');
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'denied' | 'unsupported' | 'error'>('idle');

  useEffect(() => {
    setMounted(true);
    const mm = window.matchMedia('(display-mode: standalone)').matches;
    // iOS Safari standalone flag:
    const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(mm || ios);
  }, []);

  if (!mounted || !VAPID) return null;

  if (!standalone) {
    return <p className="text-xs text-mist">{t('iosHint')}</p>;
  }

  async function enable() {
    setState('busy');
    const r = await subscribeToPush(VAPID);
    setState(r === 'ok' ? 'ok' : r === 'denied' ? 'denied' : r === 'unsupported' ? 'unsupported' : 'error');
  }

  if (state === 'ok') return <p className="text-xs text-gold-dark">{t('enabled')}</p>;

  return (
    <div className="space-y-1">
      <button onClick={enable} disabled={state === 'busy'} className="btn-gold text-xs">
        {state === 'busy' ? t('enabling') : t('enableAlerts')}
      </button>
      {state === 'denied' && <p className="text-xs text-red-600">{t('denied')}</p>}
      {state === 'unsupported' && <p className="text-xs text-mist">{t('unsupported')}</p>}
      {state === 'error' && <p className="text-xs text-red-600">{t('error')}</p>}
    </div>
  );
}
