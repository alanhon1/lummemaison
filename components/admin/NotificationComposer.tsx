'use client';

import { useMemo, useState } from 'react';
import { Send, Package, MessageSquare } from 'lucide-react';

// Admin notification composer (Phase 2). Sends a targeted customer notification
// (inbox + Web Push to push-ON users) via POST /api/admin/notify. Two modes:
// Product (picker + subtype) and Custom (title/body/link). General announcements
// stay in the Announcements page (which already pushes), so they're not here.

interface ProductOption { id: number; name: string; }
type Mode = 'product' | 'custom';
type Subtype = 'new' | 'restock' | 'benefit';

const SUBTYPES: Array<{ value: Subtype; label: string }> = [
  { value: 'new', label: 'New arrival' },
  { value: 'restock', label: 'Back in stock' },
  { value: 'benefit', label: 'Benefit / highlight' },
];

export default function NotificationComposer({ products }: { products: ProductOption[] }) {
  const [mode, setMode] = useState<Mode>('product');

  // Product mode
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [subtype, setSubtype] = useState<Subtype>('new');
  const [note, setNote] = useState('');

  // Custom mode
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  const selected = products.find(p => p.id === productId) ?? null;

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const payload =
        mode === 'product'
          ? { type: 'product', productId, productName: selected?.name, subtype, note }
          : { type: 'custom', title, body, url };
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ ok: false, text: data.error || 'Send failed' });
      } else {
        setResult({
          ok: true,
          text: `Sent to ${data.users} subscriber${data.users === 1 ? '' : 's'} (${data.pushed} device push${data.pushed === 1 ? '' : 'es'}).`,
        });
        // Reset the composed fields, keep the mode.
        if (mode === 'custom') { setTitle(''); setBody(''); setUrl(''); }
        else { setNote(''); }
      }
    } catch {
      setResult({ ok: false, text: 'Network error' });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    !sending &&
    (mode === 'product' ? !!productId : title.trim().length > 0 && body.trim().length > 0);

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest rounded transition-colors ${
      active ? 'bg-charcoal text-cream' : 'text-mist hover:text-charcoal hover:bg-cream'
    }`;

  return (
    <div className="border border-bone rounded-sm bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode('product')} className={tabCls(mode === 'product')}>
          <Package size={13} /> Product
        </button>
        <button onClick={() => setMode('custom')} className={tabCls(mode === 'custom')}>
          <MessageSquare size={13} /> Custom
        </button>
      </div>

      {mode === 'product' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Product</label>
            {selected ? (
              <div className="flex items-center justify-between gap-2 border border-bone rounded-sm px-3 py-2">
                <span className="text-sm text-charcoal">{selected.name}</span>
                <button
                  onClick={() => { setProductId(null); setQuery(''); }}
                  className="text-xs text-mist hover:text-charcoal"
                >
                  change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="w-full border border-bone rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
                {matches.length > 0 && (
                  <ul className="mt-1 border border-bone rounded-sm divide-y divide-bone max-h-56 overflow-auto">
                    {matches.map(p => (
                      <li key={p.id}>
                        <button
                          onClick={() => setProductId(p.id)}
                          className="w-full text-left px-3 py-2 text-sm text-charcoal hover:bg-cream"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {SUBTYPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSubtype(s.value)}
                  className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                    subtype === s.value
                      ? 'border-gold bg-cream text-charcoal'
                      : 'border-bone text-mist hover:text-charcoal'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Added below the default message…"
              className="w-full border border-bone rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <p className="text-[11px] text-mist">Links to the product page; only push-ON customers receive it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-bone rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              className="w-full border border-bone rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-mist mb-1">Link (optional)</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/product/123  or  https://…"
              className="w-full border border-bone rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={send}
          disabled={!canSend}
          className="btn-gold text-xs inline-flex items-center gap-2 disabled:opacity-60"
        >
          <Send size={13} /> {sending ? 'Sending…' : 'Send notification'}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.text}</span>
        )}
      </div>
    </div>
  );
}
