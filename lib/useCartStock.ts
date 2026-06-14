'use client';

import { useEffect } from 'react';
import { useCartStore } from './store';
import { useStockStore } from './stock-store';

export interface CartStockInfo {
  // Real-time stock for a cart line, or undefined while still loading.
  stockOf: (id: number) => number | undefined;
  // True once stock is known to be 0 or less for this line. The line is still
  // orderable (a backorder) — this only drives the "Backorder" label, it does
  // NOT block adding, editing quantity, or checking out.
  isBackorder: (id: number) => boolean;
}

// Loads real-time Supabase stock for every cart line so the UI can flag
// backordered (out-of-stock) lines. Oversell is allowed by design: we never
// clamp quantities down to stock and never block checkout here. The shortfall is
// handled on the admin side (an oversold order can't be packed until restocked).
export function useCartStock(): CartStockInfo {
  const items = useCartStore(s => s.items);
  const stockMap = useStockStore(s => s.stockMap);
  const ensureLoaded = useStockStore(s => s.ensureLoaded);

  // Fetch live stock for everything currently in the cart.
  useEffect(() => {
    for (const i of items) ensureLoaded(i.id);
  }, [items, ensureLoaded]);

  const stockOf = (id: number) => stockMap[id];
  const isBackorder = (id: number) => {
    const s = stockMap[id];
    return typeof s === 'number' && s <= 0;
  };
  return { stockOf, isBackorder };
}
