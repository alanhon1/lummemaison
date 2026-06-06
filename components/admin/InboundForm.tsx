'use client';

import { useActionState } from 'react';
import { addInbound, type StockActionResult } from '@/app/manzura/stock/actions';

interface Product {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
}

export default function InboundForm({
  products,
  companies,
}: {
  products: Product[];
  companies: Company[];
}) {
  const [state, action, pending] = useActionState<StockActionResult | null, FormData>(addInbound, null);

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-xl font-light text-charcoal mb-6">Add Inbound Stock</h2>

      {state?.ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-4 py-2 mb-4">
          Stock added successfully.
        </p>
      )}
      {state && !state.ok && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-4 py-2 mb-4">
          {state.error}
        </p>
      )}

      <form action={action} className="space-y-4">
        {/* Company */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
            Company / Supplier
          </label>
          <input
            list="company-list"
            name="company_name"
            required
            placeholder="Type or select a supplier…"
            className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
          />
          <datalist id="company-list">
            {companies.map(c => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <p className="text-[10px] text-mist mt-1">Type a new name to create a new supplier.</p>
        </div>

        {/* Product */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
            Product
          </label>
          <select
            name="product_id"
            required
            defaultValue=""
            className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
          >
            <option value="" disabled>Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                #{p.id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
            Quantity
          </label>
          <input
            type="number"
            name="quantity"
            min="1"
            step="1"
            required
            placeholder="0"
            className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            name="note"
            maxLength={200}
            placeholder="e.g. Invoice #1234, batch ref…"
            className="w-full border border-bone rounded px-3 py-2 text-sm text-charcoal bg-white focus:outline-none focus:border-gold"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="bg-charcoal text-cream text-xs uppercase tracking-widest px-6 py-2.5 rounded hover:bg-charcoal/90 transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add Stock'}
        </button>
      </form>
    </div>
  );
}
