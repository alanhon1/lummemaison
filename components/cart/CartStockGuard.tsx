'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCartStore, cartLineKey } from '@/lib/store';
import { useCartCaps, useCapStore } from '@/lib/cap-store';
import { capKey } from '@/lib/products/capKey';

// Mounted once in the layout. Clamps any persisted cart line that is above what
// we can supply, and shows a one-time notice.
//
// The server never tells us HOW MANY are available (stock counts must not reach
// the browser — see app/api/products/caps/route.ts), only that the line is over
// the limit. So this steps the quantity down ONE at a time: each decrement
// re-queries the line, and the loop converges — either `mustReduce` clears, or
// the quantity reaches 0 and updateQuantity drops the line entirely. A line
// whose answer is still loading (undefined) is never touched.
export default function CartStockGuard() {
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const map = useCapStore(s => s.map);
  const [adjusted, setAdjusted] = useState(false);

  // Trigger the batched cap load for every cart line.
  useCartCaps();

  useEffect(() => {
    let changed = false;
    for (const item of items) {
      const entry = map[capKey(item.id, item.option ?? '')];
      // Only act on an answer computed for the quantity the line actually holds
      // right now — a stale answer would step the line down too far.
      if (entry && entry.forQuantity === item.quantity && entry.mustReduce) {
        updateQuantity(cartLineKey(item), item.quantity - 1); // 0 ⇒ line removed
        changed = true;
      }
    }
    if (changed) setAdjusted(true);
  }, [items, map, updateQuantity]);

  useEffect(() => {
    if (!adjusted) return;
    const id = setTimeout(() => setAdjusted(false), 6000);
    return () => clearTimeout(id);
  }, [adjusted]);

  if (!adjusted) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
      <span>Some quantities were adjusted to match available stock.</span>
      <button onClick={() => setAdjusted(false)} aria-label="Dismiss" className="text-cream/70 hover:text-cream">
        <X size={14} />
      </button>
    </div>
  );
}
