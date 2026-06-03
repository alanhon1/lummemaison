'use client';

import { create } from 'zustand';

interface StockStore {
  stockMap: Record<number, number>;
  // `undefined` = not yet known. Components show "loading" briefly, then a
  // real number arrives once the batched fetch returns.
  ensureLoaded: (id: number) => void;
  getStock: (id: number) => number | undefined;
  setStock: (id: number, stock: number) => void;
}

const pending = new Set<number>();
let scheduled = false;

async function flush(set: (fn: (state: StockStore) => Partial<StockStore>) => void) {
  if (pending.size === 0) return;
  const ids = Array.from(pending);
  pending.clear();
  scheduled = false;
  try {
    const res = await fetch(`/api/products/stock?ids=${ids.join(',')}`);
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, number>;
    set(state => {
      const next = { ...state.stockMap };
      for (const id of ids) {
        const v = data[String(id)];
        next[id] = typeof v === 'number' ? v : 0;
      }
      return { stockMap: next };
    });
  } catch {
    // Network errors are non-fatal — components fall back to "stock unknown".
  }
}

export const useStockStore = create<StockStore>((set, get) => ({
  stockMap: {},
  ensureLoaded(id) {
    if (get().stockMap[id] !== undefined) return;
    pending.add(id);
    if (!scheduled) {
      scheduled = true;
      // Batch all calls in the current tick into a single request — N product
      // cards mount in the same render and we want N=1 API hit, not N.
      Promise.resolve().then(() => flush(set));
    }
  },
  getStock(id) {
    return get().stockMap[id];
  },
  setStock(id, stock) {
    set(state => ({ stockMap: { ...state.stockMap, [id]: stock } }));
  },
}));

// Convenience hook for components: subscribes to the slice and triggers a
// fetch if the id isn't known yet. Returns `undefined` while loading.
export function useProductStock(id: number): number | undefined {
  const stock = useStockStore(s => s.stockMap[id]);
  const ensureLoaded = useStockStore(s => s.ensureLoaded);
  if (typeof window !== 'undefined' && stock === undefined) {
    // Calling during render is allowed — it only enqueues. The microtask
    // flush triggers a state update which re-renders consumers.
    ensureLoaded(id);
  }
  return stock;
}
