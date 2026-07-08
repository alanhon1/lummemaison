'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Fires the ops-hub status pull when the admin opens the orders list, at most
// once a minute per tab. Silent by design — if anything was applied the list
// refreshes so the new statuses just appear.
const THROTTLE_MS = 60_000;

export default function OpsSyncTrigger() {
  const router = useRouter();

  useEffect(() => {
    const last = Number(sessionStorage.getItem('ops_sync_at') ?? 0);
    if (Date.now() - last < THROTTLE_MS) return;
    sessionStorage.setItem('ops_sync_at', String(Date.now()));

    (async () => {
      try {
        const res = await fetch('/api/admin/ops-sync', { method: 'POST' });
        if (!res.ok) return;
        const data = (await res.json()) as { applied?: number };
        if ((data.applied ?? 0) > 0) router.refresh();
      } catch {
        // Offline hub is fine — statuses just don't advance this pass.
      }
    })();
  }, [router]);

  return null;
}
