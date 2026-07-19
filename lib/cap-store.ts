'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { useCartStore } from './store';
import { capKey } from './products/capKey';

interface CapStore {
  // capKey(id, option) -> effective orderable cap. `undefined` = not yet known.
  // Consumers must NOT treat unknown as 0 (a slow/failed fetch must never clamp
  // or drop a line).
  map: Record<string, number | undefined>;
  // capKey(id, option) -> the product's per-order limit (null = no limit), or
  // `undefined` while unknown. Used only to pick the cart message; never to
  // clamp (that's `map`, which already folds the per-order limit in).
  perOrder: Record<string, number | null | undefined>;
  ensureLoaded: (id: number, option?: string) => void;
}

const pending = new Map<string, { product_id: number; option: string }>();
let scheduled = false;

async function flush(set: (fn: (state: CapStore) => Partial<CapStore>) => void) {
  if (pending.size === 0) return;
  const entries = Array.from(pending.values());
  pending.clear();
  scheduled = false;
  try {
    const res = await fetch('/api/products/caps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: entries }),
    });
    if (!res.ok) return; // leave entries unknown
    const data = (await res.json()) as Record<string, { cap: number; perOrder: number | null }>;
    set(state => {
      const next = { ...state.map };
      const nextPerOrder = { ...state.perOrder };
      for (const e of entries) {
        const key = capKey(e.product_id, e.option);
        const v = data[key];
        if (v && typeof v.cap === 'number') {
          next[key] = v.cap;
          nextPerOrder[key] = v.perOrder ?? null;
        }
      }
      return { map: next, perOrder: nextPerOrder };
    });
  } catch {
    // Network errors are non-fatal — lines stay "unknown" (never clamped). The
    // authoritative createOrder guard still refuses an oversized order.
  }
}

export const useCapStore = create<CapStore>((set, get) => ({
  map: {},
  perOrder: {},
  ensureLoaded(id, option = '') {
    const key = capKey(id, option);
    if (get().map[key] !== undefined) return;
    pending.set(key, { product_id: id, option });
    if (!scheduled) {
      scheduled = true;
      // Batch every (id, option) requested in the current tick into one POST.
      Promise.resolve().then(() => flush(set));
    }
  },
}));

export interface CartCapsInfo {
  // Max orderable quantity for a cart line, or undefined while loading.
  capOf: (item: { id: number; option?: string }) => number | undefined;
  // The product's per-order limit for a cart line (null = none), or undefined
  // while loading. When it equals `capOf`, the per-order limit — not stock — is
  // what's holding the quantity back, so the cart shows "Limited to N per order".
  perOrderOf: (item: { id: number; option?: string }) => number | null | undefined;
}

// Loads the orderable cap for every cart line so the cart/checkout can disable
// the "+" button at the cap and offer a request instead.
export function useCartCaps(): CartCapsInfo {
  const items = useCartStore(s => s.items);
  const map = useCapStore(s => s.map);
  const perOrder = useCapStore(s => s.perOrder);
  const ensureLoaded = useCapStore(s => s.ensureLoaded);

  useEffect(() => {
    for (const i of items) ensureLoaded(i.id, i.option ?? '');
  }, [items, ensureLoaded]);

  const capOf = (item: { id: number; option?: string }) => map[capKey(item.id, item.option ?? '')];
  const perOrderOf = (item: { id: number; option?: string }) => perOrder[capKey(item.id, item.option ?? '')];
  return { capOf, perOrderOf };
}
