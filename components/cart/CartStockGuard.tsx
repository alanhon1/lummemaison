'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCartStore, cartLineKey } from '@/lib/store';
import { useCartCaps, useCapStore } from '@/lib/cap-store';
import { capKey } from '@/lib/products/capKey';

// Mounted once in the layout. When live caps load, it clamps any persisted cart
// line whose quantity exceeds its orderableCap (a cap-0 line is removed, since
// updateQuantity(<=0) drops the line) and shows a one-time notice. Only acts on
// KNOWN numeric caps — a still-loading/failed cap (undefined) never clamps.
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
      const cap = map[capKey(item.id, item.option ?? '')];
      if (typeof cap === 'number' && item.quantity > cap) {
        updateQuantity(cartLineKey(item), cap); // cap 0 ⇒ line removed
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
