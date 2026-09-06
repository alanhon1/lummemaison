'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { useCartStore } from './store';
import { capKey } from './products/capKey';
import type { CapAnswer } from '@/app/api/products/caps/route';

// Purchase limits for cart lines and catalogue cards. The server never sends a
// stock number (see app/api/products/caps/route.ts) — only whether one more may
// be added, whether the line is already over what we can supply, and which
// constraint is binding. Because the answer depends on the quantity the cart
// currently holds, each cached entry remembers the quantity it was computed
// for and is refetched when that changes.

interface Entry extends CapAnswer {
  // Quantity this answer was computed for; a different quantity invalidates it.
  forQuantity: number;
}

interface CapStore {
  // capKey(id, option) -> answer. `undefined` = not yet known. Consumers must
  // NOT treat unknown as blocked — a slow or failed fetch must never clamp or
  // drop a line. The authoritative guard is createOrder.
  map: Record<string, Entry | undefined>;
  ensureLoaded: (id: number, option?: string, quantity?: number) => void;
}

const pending = new Map<string, { product_id: number; option: string; quantity: number }>();
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
    const data = (await res.json()) as Record<string, CapAnswer>;
    set(state => {
      const next = { ...state.map };
      for (const e of entries) {
        const key = capKey(e.product_id, e.option);
        const v = data[key];
        if (v && typeof v.canAdd === 'boolean') {
          next[key] = { ...v, forQuantity: e.quantity };
        }
      }
      return { map: next };
    });
  } catch {
    // Network errors are non-fatal — lines stay "unknown" (never clamped). The
    // authoritative createOrder guard still refuses an oversized order.
  }
}

export const useCapStore = create<CapStore>((set, get) => ({
  map: {},
  ensureLoaded(id, option = '', quantity = 0) {
    const key = capKey(id, option);
    const cached = get().map[key];
    if (cached && cached.forQuantity === quantity) return;
    pending.set(key, { product_id: id, option, quantity });
    if (!scheduled) {
      scheduled = true;
      // Batch every (id, option) requested in the current tick into one POST.
      Promise.resolve().then(() => flush(set));
    }
  },
}));

// Single-line variant for catalogue cards and the product page, where there is
// one (product, option) and the quantity already in the cart. Returns undefined
// while loading — callers must treat that as "allow", never as blocked.
export function useProductCap(
  id: number,
  option = '',
  quantity = 0,
): CapAnswer | undefined {
  const entry = useCapStore(s => s.map[capKey(id, option)]);
  const ensureLoaded = useCapStore(s => s.ensureLoaded);

  useEffect(() => {
    ensureLoaded(id, option, quantity);
  }, [id, option, quantity, ensureLoaded]);

  return entry;
}

export interface CartCapsInfo {
  // The full answer for a cart line, or undefined while loading.
  answerOf: (item: { id: number; option?: string }) => CapAnswer | undefined;
  // May one more be added? `undefined` while loading — treat as "allow" so a
  // slow fetch never blocks a legitimate cart.
  canAdd: (item: { id: number; option?: string }) => boolean | undefined;
  // Is the line already above what we can supply? Blocks checkout until reduced.
  mustReduce: (item: { id: number; option?: string }) => boolean;
  // The product's per-order limit (null = none), or undefined while loading.
  // Safe to display: an admin policy number, not an inventory count.
  perOrderOf: (item: { id: number; option?: string }) => number | null | undefined;
}

// Loads the purchase limits for every cart line so the cart/checkout can
// disable "+" at the limit and offer a request instead. Re-queries whenever a
// line's quantity changes, because the answer is quantity-relative.
export function useCartCaps(): CartCapsInfo {
  const items = useCartStore(s => s.items);
  const map = useCapStore(s => s.map);
  const ensureLoaded = useCapStore(s => s.ensureLoaded);

  useEffect(() => {
    for (const i of items) ensureLoaded(i.id, i.option ?? '', i.quantity);
  }, [items, ensureLoaded]);

  const entryOf = (item: { id: number; option?: string }) => map[capKey(item.id, item.option ?? '')];
  return {
    answerOf: entryOf,
    canAdd: item => entryOf(item)?.canAdd,
    mustReduce: item => entryOf(item)?.mustReduce ?? false,
    perOrderOf: item => entryOf(item)?.perOrder,
  };
}
