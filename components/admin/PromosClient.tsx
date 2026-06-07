'use client';

import { useState, useTransition } from 'react';
import { createPromoCode, togglePromoCode, deletePromoCode } from '@/app/manzura/promos/actions';

export interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_cents: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Props { codes: PromoCode[]; }

function formatDiscount(type: string, value: number): string {
  if (type === 'percent') return `${value}%`;
  return `$${(value / 100).toFixed(2)}`;
}

export default function PromosClient({ codes }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPromoCode(fd);
      if (!result.ok) { setFormError(result.error); return; }
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
    });
  }

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => { await togglePromoCode(id, !current); });
  }

  function handleDelete(id: number, code: string) {
    if (!window.confirm(`Delete code "${code}"?`)) return;
    startTransition(async () => {
      const result = await deletePromoCode(id);
      if (!result.ok) alert(result.error);
    });
  }

  const inputCls = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';
  const labelCls = 'block text-xs font-semibold tracking-wide text-mist uppercase mb-1';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-charcoal">Promo Codes</h1>
          <p className="text-xs text-mist mt-0.5">{codes.length} code{codes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-gold text-xs">
          {showForm ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-bone rounded-lg p-5 mb-6 space-y-4">
          <h2 className="font-display italic text-lg text-charcoal">New Promo Code</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code *</label>
              <input name="code" required placeholder="SUMMER20" className={`${inputCls} uppercase`} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input name="description" placeholder="Summer 2026 promo" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Discount Type *</label>
              <select name="discount_type" required className={inputCls}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Discount Value *</label>
              <input name="discount_value" type="number" min="1" step="1" required placeholder="10" className={inputCls} />
              <p className="text-[10px] text-mist mt-1">For percent: 1–100. For fixed: value in cents (e.g. 1000 = $10)</p>
            </div>
            <div>
              <label className={labelCls}>Min Order (cents)</label>
              <input name="min_order_cents" type="number" min="0" placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Uses (blank = unlimited)</label>
              <input name="max_uses" type="number" min="1" placeholder="" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expires At</label>
              <input name="expires_at" type="datetime-local" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes (internal)</label>
              <input name="notes" placeholder="Internal memo…" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-gold text-xs">
              {isPending ? 'Creating…' : 'Create Code'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {codes.length === 0 ? (
        <div className="bg-white border border-bone rounded-lg p-8 text-center text-sm text-mist italic">
          No promo codes yet. Create one above.
        </div>
      ) : (
        <div className="bg-white border border-bone rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bone bg-cream text-xs font-semibold tracking-wide text-mist uppercase">
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Discount</th>
                <th className="text-right px-4 py-3">Min Order</th>
                <th className="text-right px-4 py-3">Uses</th>
                <th className="text-left px-4 py-3">Expires</th>
                <th className="text-center px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => {
                const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
                return (
                  <tr key={c.id} className="border-b border-bone last:border-0 hover:bg-cream/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-charcoal">{c.code}</div>
                      {c.description && <div className="text-xs text-mist">{c.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-charcoal">{formatDiscount(c.discount_type, c.discount_value)}</td>
                    <td className="px-4 py-3 text-right text-mist">{c.min_order_cents > 0 ? `$${(c.min_order_cents / 100).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-charcoal">{c.used_count}</span>
                      <span className="text-mist">/{c.max_uses ?? '∞'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-mist">
                      {c.expires_at
                        ? <span className={expired ? 'text-red-500' : ''}>{new Date(c.expires_at).toLocaleDateString()}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(c.id, c.active)}
                        disabled={isPending}
                        className={`w-10 h-5 rounded-full transition-colors ${c.active ? 'bg-gold' : 'bg-bone'}`}
                        title={c.active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`block w-4 h-4 rounded-full bg-white mx-auto shadow transition-transform ${c.active ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id, c.code)}
                        disabled={isPending || c.used_count > 0}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={c.used_count > 0 ? 'Cannot delete — code has been used' : 'Delete'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
