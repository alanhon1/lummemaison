'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { subscribeToPush, unsubscribeFromPush, getPushState } from '@/components/pwa/pushClient';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const API_BASE = '/api/admin/push';

// Phase 3: lets the owner turn on order-alert Web Push from the installed admin
// app. iOS only allows Web Push from an installed (standalone) PWA, so — like the
// customer button — this only appears when running standalone; in a browser it
// shows a short hint to install first.
export default function EnableAdminAlertsButton() {
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
  if (!standalone) {
    return <p className="text-xs text-mist">Install this admin app to your home screen to enable order push alerts.</p>;
  }
  if (sub === 'loading') return null;
  if (sub === 'unsupported') return <p className="text-xs text-mist">Push isn’t supported on this device.</p>;

  async function enable() {
    setBusy(true); setErr('');
    const r = await subscribeToPush(VAPID, API_BASE);
    setBusy(false);
    if (r === 'ok') setSub('on');
    else setErr(r === 'denied' ? 'denied' : 'error');
  }

  async function disable() {
    setBusy(true); setErr('');
    await unsubscribeFromPush(API_BASE);
    setBusy(false);
    setSub('off');
  }

  if (sub === 'on') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-gold-dark inline-flex items-center gap-1"><Bell size={13} /> Order alerts on</span>
        <button onClick={disable} disabled={busy} className="text-xs text-mist underline hover:text-charcoal disabled:opacity-50">
          {busy ? 'Turning off…' : 'Turn off'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button onClick={enable} disabled={busy} className="btn-gold text-xs inline-flex items-center gap-2">
        <Bell size={13} /> {busy ? 'Enabling…' : 'Enable order alerts'}
      </button>
      {err === 'denied' && <p className="text-xs text-red-600">Notifications were blocked. Enable them in your device settings.</p>}
      {err === 'error' && <p className="text-xs text-red-600">Couldn’t enable alerts. Try again.</p>}
    </div>
  );
}
