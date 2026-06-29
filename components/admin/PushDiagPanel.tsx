// components/admin/PushDiagPanel.tsx
// TEMPORARY admin diagnostics for Web Push. "Run diagnostics" shows how many
// subscriptions exist and whether the VAPID env vars are present in production;
// "Send test push" delivers to every saved subscription and shows the result.
'use client';

import { useState } from 'react';

export default function PushDiagPanel() {
  const [diag, setDiag] = useState<string>('');
  const [test, setTest] = useState<string>('');
  const [busy, setBusy] = useState<'' | 'diag' | 'test'>('');

  async function runDiag() {
    setBusy('diag'); setDiag('');
    try {
      const res = await fetch('/api/push/diag');
      setDiag(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setDiag(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally { setBusy(''); }
  }

  async function runTest() {
    if (!window.confirm('Send a TEST push to every saved subscription?')) return;
    setBusy('test'); setTest('');
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      setTest(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setTest(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally { setBusy(''); }
  }

  return (
    <div className="bg-white border border-bone rounded-lg p-5 space-y-3">
      <h2 className="font-display italic text-lg text-charcoal">Push diagnostics</h2>
      <p className="text-xs text-mist">
        Temporary tools to debug notifications. Run diagnostics to see saved subscriptions + VAPID config,
        then send a test push to all subscribed devices.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={runDiag} disabled={busy !== ''} className="btn-secondary text-xs">
          {busy === 'diag' ? 'Checking…' : 'Run diagnostics'}
        </button>
        <button onClick={runTest} disabled={busy !== ''} className="btn-gold text-xs">
          {busy === 'test' ? 'Sending…' : 'Send test push to all'}
        </button>
      </div>
      {diag && (
        <pre className="text-[11px] bg-cream border border-bone rounded p-3 overflow-x-auto whitespace-pre-wrap text-charcoal">{diag}</pre>
      )}
      {test && (
        <pre className="text-[11px] bg-cream border border-bone rounded p-3 overflow-x-auto whitespace-pre-wrap text-charcoal">{test}</pre>
      )}
    </div>
  );
}
