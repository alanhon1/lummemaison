// components/admin/PushDiagPanel.tsx
// Admin diagnostics for Web Push (read-only). Shows how many subscriptions exist
// and whether the VAPID env vars are present in production. There is intentionally
// NO "send to all" button — customer pushes are targeted and sent from the
// Announcements page.
'use client';

import { useState } from 'react';

export default function PushDiagPanel() {
  const [diag, setDiag] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function runDiag() {
    setBusy(true); setDiag('');
    try {
      const res = await fetch('/api/push/diag');
      setDiag(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setDiag(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-bone rounded-lg p-5 space-y-3">
      <h2 className="font-display italic text-lg text-charcoal">Push diagnostics</h2>
      <p className="text-xs text-mist">
        Read-only. Shows saved subscriptions and whether the VAPID keys are configured in production.
      </p>
      <button onClick={runDiag} disabled={busy} className="btn-secondary text-xs">
        {busy ? 'Checking…' : 'Run diagnostics'}
      </button>
      {diag && (
        <pre className="text-[11px] bg-cream border border-bone rounded p-3 overflow-x-auto whitespace-pre-wrap text-charcoal">{diag}</pre>
      )}
    </div>
  );
}
