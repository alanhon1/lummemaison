'use client';

import { useEffect } from 'react';
import { useCartStore } from './store';
import { useStockStore } from './stock-store';

export interface CartStockInfo {
  // Real-time stock for a cart line, or undefined while still loading.
  stockOf: (id: number) => number | undefined;
  // True once stock is known to be 0 for this line.
  isSoldOut: (id: number) => boolean;
  // True if any line in the cart is sold out — checkout should be blocked.
  hasSoldOut: boolean;
}

// Reconciles the persisted cart against real-time Supabase stock whenever the
// cart is shown:
//   • loads current stock for every line,
//   • auto-clamps any line whose quantity now exceeds available stock (e.g. the
//     user kept 2 but only 1 remains -> silently drops to 1),
//   • flags lines that are fully sold out so the UI can show "Sold out" and
//     block checkout (these are NOT removed — the customer removes them).
export function useCartStock(): CartStockInfo {
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const stockMap = useStockStore(s => s.stockMap);
  const ensureLoaded = useStockStore(s => s.ensureLoaded);

  // Fetch live stock for everything currently in the cart.
  useEffect(() => {
    for (const i of items) ensureLoaded(i.id);
  }, [items, ensureLoaded]);

  // Auto-clamp over-quantity lines down to what's actually available. Sold-out
  // lines (stock 0) are left untouched so the cart can surface them.
  useEffect(() => {
    for (const i of items) {
      const s = stockMap[i.id];
      if (typeof s === 'number' && s > 0 && i.quantity > s) {
        updateQuantity(i.id, s);
      }
    }
  }, [items, stockMap, updateQuantity]);

  const stockOf = (id: number) => stockMap[id];
  const isSoldOut = (id: number) => stockMap[id] === 0;
  const hasSoldOut = items.some(i => stockMap[i.id] === 0);
  return { stockOf, isSoldOut, hasSoldOut };
}
