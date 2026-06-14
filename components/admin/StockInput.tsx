'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { saveProductStockAction } from '@/app/manzura/products/actions';

interface Props {
  productId: number;
  initialStock: number;
  initialUnknown?: boolean;
}

export default function StockInput({ productId, initialStock, initialUnknown = false }: Props) {
  const [value, setValue] = useState(String(initialStock));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = Math.max(0, Math.floor(Number.parseInt(value, 10) || 0));
  const dirty = parsed !== initialStock;
  // Once the admin types and saves a number, the row is no longer "unknown".
  // We only show the ??? warning until that first save in this session.
  const showUnknown = initialUnknown && savedAt === null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveProductStockAction(productId, parsed);
      if (!res.ok) {
        setError(res.error ?? 'Save failed.');
        return;
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-bone rounded-md p-4 flex items-center gap-4">
      <div className="flex-1">
        <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-mist mb-1">
          Stock
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={saving}
            className="w-28 bg-white border border-bone rounded-md px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="btn-gold text-xs flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save stock'}
          </button>
          {showUnknown && (
            <span className="text-[10px] uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
              ??? — set the real stock (counts as 0 until you do)
            </span>
          )}
          {parsed === 0 && (
            <span className="text-[10px] uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded">
              Sold out
            </span>
          )}
          {savedAt && !dirty && !saving && (
            <span className="text-xs text-emerald-700">Saved.</span>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
