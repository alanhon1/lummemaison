// components/admin/AnnounceForm.tsx
'use client';

import { useState } from 'react';

export default function AnnounceForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function send() {
    if (!title.trim() || !body.trim()) { setResult('Title and message are required.'); return; }
    if (!window.confirm('Send this notification to all opted-in clients?')) return;
    setBusy(true); setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setResult(data.error || 'Send failed.'); return; }
      setResult(`Sent to ${data.sent}, failed ${data.failed}, pruned ${data.pruned}.`);
      setTitle(''); setBody(''); setUrl('');
    } finally { setBusy(false); }
  }

  const input = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';

  return (
    <div className="bg-white border border-bone rounded-lg p-5 space-y-3">
      <h2 className="font-display italic text-lg text-charcoal">Announce to clients</h2>
      <input className={input} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={input} placeholder="Message" rows={3} value={body} onChange={e => setBody(e.target.value)} />
      <input className={input} placeholder="Optional link (e.g. /catalogue or a product URL)" value={url} onChange={e => setUrl(e.target.value)} />
      <div className="flex items-center gap-3">
        <button onClick={send} disabled={busy} className="btn-gold text-xs">{busy ? 'Sending…' : 'Send announcement'}</button>
        {result && <span className="text-xs text-mist">{result}</span>}
      </div>
    </div>
  );
}
