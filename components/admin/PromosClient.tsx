'use client';

import { useState, useTransition } from 'react';
import { createPromoCode, updatePromoCode, togglePromoCode, deletePromoCode } from '@/app/manzura/promos/actions';

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
  include_shipping: boolean;
  flat_shipping_cents: number | null;
  exclude_category_ids: string[];
  created_at: string;
}

interface CategoryOption { id: string; name: string; }

interface Props { codes: PromoCode[]; categories: CategoryOption[]; }

function formatDiscount(type: string, value: number): string {
  if (type === 'percent') return `${value}%`;
  return `$${(value / 100).toFixed(2)}`;
}

// Stored expiry is an ISO/UTC string; the datetime-local input wants
// "YYYY-MM-DDTHH:mm" in the browser's local time. Shift by the tz offset so the
// pre-filled value shows the same instant and round-trips back unchanged.
function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PromosClient({ codes, categories }: Props) {
  const [showForm, setShowForm] = useState(false);
  // null while creating; the row being edited otherwise. The same form serves
  // both — pre-filled from `editing` and re-mounted via `key` so defaults apply.
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [formError, setFormError] = useState('');
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(c: PromoCode) {
    setEditing(c);
    setFormError('');
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = editing ? await updatePromoCode(editing.id, fd) : await createPromoCode(fd);
      if (!result.ok) { setFormError(result.error); return; }
      closeForm();
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

  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;
  const inputCls = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';
  const labelCls = 'block text-xs font-semibold tracking-wide text-mist uppercase mb-1';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-charcoal">Promo Codes</h1>
          <p className="text-xs text-mist mt-0.5">{codes.length} code{codes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => (showForm ? closeForm() : openCreate())} className="btn-gold text-xs">
          {showForm ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {/* Create / edit form — same fields for both; pre-filled when editing. */}
      {showForm && (
        <form
          key={editing ? `edit-${editing.id}` : 'new'}
          onSubmit={handleSubmit}
          className="bg-white border border-bone rounded-lg p-5 mb-6 space-y-4"
        >
          <h2 className="font-display italic text-lg text-charcoal">
            {editing ? `Edit “${editing.code}”` : 'New Promo Code'}
          </h2>
          {editing && (
            <p className="text-xs text-mist">
              Used {editing.used_count}{editing.max_uses != null ? ` / ${editing.max_uses}` : ''} time
              {editing.used_count !== 1 ? 's' : ''} — the usage count is kept when you save.
            </p>
          )}
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code *</label>
              <input name="code" required placeholder="SUMMER20" defaultValue={editing?.code ?? ''} className={`${inputCls} uppercase`} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input name="description" placeholder="Summer 2026 promo" defaultValue={editing?.description ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Discount Type *</label>
              <select name="discount_type" required defaultValue={editing?.discount_type ?? 'percent'} className={inputCls}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Discount Value *</label>
              <input name="discount_value" type="number" min="1" step="1" required placeholder="10" defaultValue={editing?.discount_value ?? ''} className={inputCls} />
              <p className="text-[10px] text-mist mt-1">For percent: 1–100. For fixed: value in cents (e.g. 1000 = $10)</p>
            </div>
            <div>
              <label className={labelCls}>Discount applies to</label>
              <select name="include_shipping" defaultValue={editing ? (editing.include_shipping ? '1' : '0') : '0'} className={inputCls}>
                <option value="0">Products subtotal (shipping excluded)</option>
                <option value="1">Order total (shipping included)</option>
              </select>
              <p className="text-[10px] text-mist mt-1">Default discounts products only. Choose “included” to also discount shipping.</p>
            </div>
            <div>
              <label className={labelCls}>Min Order (cents)</label>
              <input name="min_order_cents" type="number" min="0" placeholder="0" defaultValue={editing && editing.min_order_cents > 0 ? editing.min_order_cents : ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Uses (blank = unlimited)</label>
              <input name="max_uses" type="number" min="1" placeholder="" defaultValue={editing?.max_uses ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expires At</label>
              <input name="expires_at" type="datetime-local" defaultValue={toLocalDatetimeInput(editing?.expires_at ?? null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes (internal)</label>
              <input name="notes" placeholder="Internal memo…" defaultValue={editing?.notes ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Flat shipping override (cents)</label>
              <input name="flat_shipping_cents" type="number" min="0" placeholder="blank = normal" defaultValue={editing?.flat_shipping_cents ?? ''} className={inputCls} />
              <p className="text-[10px] text-mist mt-1">Blank keeps the normal $35/$65 rate. e.g. 10000 = flat $100 (MAISON15).</p>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Exclude categories from the %</label>
              <select name="exclude_category_ids" multiple defaultValue={editing?.exclude_category_ids ?? []} size={Math.min(5, Math.max(2, categories.length))} className={`${inputCls} h-auto`}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-mist mt-1">Ctrl/Cmd-click to select. Excluded items still count toward the minimum — they just don’t get the % off. (MAISON15 excludes Imported Products.)</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="text-xs px-3 py-1.5 text-mist hover:text-charcoal">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-gold text-xs">
              {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create Code'}
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
                    <td className="px-4 py-3 text-charcoal">
                      {formatDiscount(c.discount_type, c.discount_value)}
                      <div className="text-[10px] text-mist">{c.include_shipping ? 'incl. shipping' : 'subtotal only'}</div>
                      {c.flat_shipping_cents != null && (
                        <div className="text-[10px] text-gold-dark">flat ship ${(c.flat_shipping_cents / 100).toFixed(0)}</div>
                      )}
                      {c.exclude_category_ids?.length > 0 && (
                        <div className="text-[10px] text-mist">excl: {c.exclude_category_ids.map(catName).join(', ')}</div>
                      )}
                    </td>
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
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEdit(c)}
                          disabled={isPending}
                          className="text-xs text-charcoal hover:text-gold-dark disabled:opacity-30"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.code)}
                          disabled={isPending || c.used_count > 0}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={c.used_count > 0 ? 'Cannot delete — code has been used' : 'Delete'}
                        >
                          Delete
                        </button>
                      </div>
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
