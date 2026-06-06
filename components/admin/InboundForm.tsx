'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addInboundBatch, type StockActionResult } from '@/app/manzura/stock/actions';

interface Product {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
}

interface ItemRow {
  product_id: string;
  quantity: string;
  note: string;
}

const emptyRow = (): ItemRow => ({ product_id: '', quantity: '', note: '' });

export default function InboundForm({
  products,
  companies,
}: {
  products: Product[];
  companies: Company[];
}) {
  const [state, action, pending] = useActionState<StockActionResult | null, FormData>(addInboundBatch, null);
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [formKey, setFormKey] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  function addRow() {
    setRows(r => [...r, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof ItemRow, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  const totalQty = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Validate rows
    const validRows = rows.filter(r => r.product_id && parseInt(r.quantity, 10) > 0);
    if (validRows.length === 0) return;

    fd.set('items', JSON.stringify(validRows.map(r => ({
      product_id: parseInt(r.product_id, 10),
      quantity: parseInt(r.quantity, 10),
      note: r.note.trim() || null,
    }))));

    // Trigger the server action via form submission
    form.requestSubmit();
  }

  // Reset form on success
  if (state?.ok) {
    // Reset happens by incrementing formKey
  }

  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-xl font-light text-charcoal mb-1">Add Inbound Stock</h2>
      <p className="text-xs text-mist mb-6">Add multiple products as a single batch.</p>

      {state?.ok && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-4 py-3 mb-4 flex items-center justify-between">
          <span>Batch added successfully.</span>
          <button
            type="button"
            onClick={() => { setRows([emptyRow()]); setFormKey(k => k + 1); }}
            className="text-xs underline underline-offset-2 text-emerald-700 hover:text-emerald-900"
          >
            Add another
          </button>
        </div>
      )}
      {state && !state.ok && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-4 py-3 mb-4">
          {state.error}
        </p>
      )}

      <form key={formKey} action={action} className="space-y-6">
        {/* Batch header */}
        <div className="bg-cream/60 border border-bone rounded p-5 grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">
              Company / Supplier <span className="text-rose-500">*</span>
            </label>
            <input
              list="company-list"
              name="company_name"
              required
              placeholder="Type or select…"
              className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
            />
            <datalist id="company-list">
              {companies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">
              Inbound Date
            </label>
            <input
              type="date"
              name="inbound_date"
              defaultValue={today}
              className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">
              Memo (optional)
            </label>
            <input
              type="text"
              name="memo"
              maxLength={200}
              placeholder="e.g. Invoice #1234…"
              className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* Product rows */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] uppercase tracking-widest text-mist">
              Products ({rows.length}) — Total qty: {totalQty}
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-gold-dark hover:text-gold border border-gold/40 hover:border-gold px-3 py-1.5 rounded transition-colors"
            >
              <Plus size={12} />
              Add Product
            </button>
          </div>

          <div className="space-y-2">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[2fr_80px_1fr_32px] gap-2 px-1">
              <span className="text-[9px] uppercase tracking-widest text-mist">Product</span>
              <span className="text-[9px] uppercase tracking-widest text-mist">Qty</span>
              <span className="text-[9px] uppercase tracking-widest text-mist">Note</span>
              <span />
            </div>

            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_80px_1fr_32px] gap-2 items-start">
                <select
                  value={row.product_id}
                  onChange={e => updateRow(i, 'product_id', e.target.value)}
                  required
                  className="w-full border border-bone rounded px-2 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
                >
                  <option value="">Select product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>#{p.id} — {p.name.length > 45 ? p.name.slice(0, 43) + '…' : p.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  value={row.quantity}
                  onChange={e => updateRow(i, 'quantity', e.target.value)}
                  min="1"
                  step="1"
                  required
                  placeholder="0"
                  className="w-full border border-bone rounded px-2 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
                />

                <input
                  type="text"
                  value={row.note}
                  onChange={e => updateRow(i, 'note', e.target.value)}
                  maxLength={100}
                  placeholder="Note…"
                  className="w-full border border-bone rounded px-2 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
                />

                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="flex items-center justify-center h-9 w-8 text-mist hover:text-rose-600 disabled:opacity-30 transition-colors"
                  aria-label="Remove row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Hidden field for serialized items */}
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(rows
              .filter(r => r.product_id && parseInt(r.quantity, 10) > 0)
              .map(r => ({
                product_id: parseInt(r.product_id, 10),
                quantity: parseInt(r.quantity, 10),
                note: r.note.trim() || null,
              }))
            )}
          />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-bone">
          <button
            type="submit"
            disabled={pending || rows.every(r => !r.product_id || !r.quantity)}
            className="bg-charcoal text-cream text-xs uppercase tracking-widest px-6 py-2.5 rounded hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            {pending ? 'Saving batch…' : `Save Batch (${rows.filter(r => r.product_id && parseInt(r.quantity, 10) > 0).length} product${rows.filter(r => r.product_id).length !== 1 ? 's' : ''})`}
          </button>
          <span className="text-xs text-mist">
            {rows.filter(r => r.product_id && parseInt(r.quantity, 10) > 0).length} valid row(s), {totalQty} total units
          </span>
        </div>
      </form>
    </div>
  );
}
