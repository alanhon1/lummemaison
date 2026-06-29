'use client';

import { useEffect } from 'react';

// If a customer subscribed to push while logged OUT, the saved row has
// client_code = null, so broadcasts (which target signed-in users) never reach
// them — and nothing backfilled it on login. This re-POSTs the existing browser
// subscription to /api/push/subscribe while authenticated, which links it to the
// user id. Idempotent (upsert by endpoint). Mounted ONLY in the customer
// [locale] layout — never on /manzura — so it can't clobber the admin's
// '__admin__' subscription (that endpoint would set client_code to the user id).
export default function PushClientCodeBackfill({ isAuthed }: { isAuthed: boolean }) {
  useEffect(() => {
    if (!isAuthed) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub || cancelled) return;
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // best-effort — broadcasts still work for already-linked subscriptions
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthed]);

  return null;
}
