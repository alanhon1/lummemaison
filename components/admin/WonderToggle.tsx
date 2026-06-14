'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toggleWonderAction } from '@/app/manzura/products/actions';
import WonderMark from './WonderMark';

export default function WonderToggle({
  productId,
  initialWonder,
}: {
  productId: number;
  initialWonder: boolean;
}) {
  const [wonder, setWonder] = useState(initialWonder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const next = !wonder;
    const res = await toggleWonderAction(productId, next);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Failed.'); return; }
    setWonder(next);
  }

  return (
    <div className="flex items-center gap-2">
      {wonder && <WonderMark />}
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="text-xs border border-bone px-3 py-1.5 rounded text-mist hover:text-charcoal transition-colors disabled:opacity-50 inline-flex items-center gap-2"
      >
        {saving && <Loader2 size={12} className="animate-spin" />}
        {wonder ? 'Unmark wonder' : 'Mark as wonder'}
      </button>
      {wonder && (
        <span className="text-[10px] text-purple-700">Stock shows ??? until you set a number.</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
