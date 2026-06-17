'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Trash2, Undo2, Inbox } from 'lucide-react';
import { setRequestStatus, deleteRequest } from '@/app/manzura/requests/actions';
import type { ProductRequest } from '@/lib/requests';

export default function RequestsClient({ requests }: { requests: ProductRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  // Demand summary: sum OPEN quantities per product+option, biggest first. This
  // is the whole point — how many units customers actually want before restock.
  const demand = useMemo(() => {
    const map = new Map<string, { name: string; option: string | null; qty: number; count: number }>();
    for (const r of requests) {
      if (r.status !== 'open') continue;
      const key = `${r.product_id}::${r.option ?? ''}`;
      const cur = map.get(key) ?? { name: r.product_name, option: r.option, qty: 0, count: 0 };
      cur.qty += r.quantity;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [requests]);

  const visible = showResolved ? requests : requests.filter(r => r.status === 'open');
  const openCount = requests.filter(r => r.status === 'open').length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Failed.');
      else router.refresh();
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-light text-charcoal">Requests</h1>
        <span className="text-xs px-3 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
          {openCount} open
        </span>
      </div>
      <p className="text-sm text-mist mb-8">
        Customers ask for these when a product is out of stock — how many units they want, so you can
        gauge demand before restocking.
      </p>

      {error && (
        <p className="text-xs text-rose-700 mb-4 bg-rose-50 border border-rose-200 px-3 py-2 rounded">{error}</p>
      )}

      {/* Demand summary */}
      {demand.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-mist mb-2">Demand (open)</h2>
          <div className="bg-white border border-bone rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-bone text-[10px] uppercase tracking-widest text-mist">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Units wanted</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Requests</th>
                </tr>
              </thead>
              <tbody>
                {demand.map(d => (
                  <tr key={`${d.name}-${d.option}`} className="border-t border-bone">
                    <td className="px-4 py-2.5 text-charcoal">
                      {d.name}{d.option ? <span className="text-mist"> ({d.option})</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-charcoal">{d.qty}</td>
                    <td className="px-4 py-2.5 text-right text-mist">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual requests */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold tracking-widest uppercase text-mist">All requests</h2>
        <label className="text-xs text-mist inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="accent-gold" />
          Show resolved
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-bone rounded p-10 text-center text-mist">
          <Inbox size={32} className="mx-auto mb-3 text-bone" />
          <p className="text-sm">No {showResolved ? '' : 'open '}requests yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-bone rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-bone text-[10px] uppercase tracking-widest text-mist">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                <th className="text-right px-4 py-2.5 font-semibold">Qty</th>
                <th className="text-left px-4 py-2.5 font-semibold">Customer</th>
                <th className="text-left px-4 py-2.5 font-semibold hidden sm:table-cell">When</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className={`border-t border-bone ${r.status === 'resolved' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 text-charcoal">
                    {r.product_name}{r.option ? <span className="text-mist"> ({r.option})</span> : null}
                    <span className="text-[10px] text-mist ml-1">#{r.product_id}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-charcoal">{r.quantity}</td>
                  <td className="px-4 py-2.5 text-mist text-xs">
                    {r.customer_email || r.customer_name || <span className="italic">anonymous</span>}
                  </td>
                  <td className="px-4 py-2.5 text-mist text-xs hidden sm:table-cell">
                    {new Date(r.created_at).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'open' ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setRequestStatus(r.id, 'resolved'))}
                          title="Mark resolved"
                          className="p-1.5 text-mist hover:text-emerald-600 border border-transparent hover:border-emerald-200 transition-colors disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setRequestStatus(r.id, 'open'))}
                          title="Reopen"
                          className="p-1.5 text-mist hover:text-charcoal border border-transparent hover:border-bone transition-colors disabled:opacity-50"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => { if (confirm('Delete this request?')) run(() => deleteRequest(r.id)); }}
                        title="Delete"
                        className="p-1.5 text-mist hover:text-rose-500 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
