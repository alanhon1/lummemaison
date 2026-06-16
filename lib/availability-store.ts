'use client';

import { create } from 'zustand';

export interface Availability {
  notForSale: boolean;
  outOfStock: boolean;
}

interface AvailabilityStore {
  // `undefined` = not yet known. Consumers must NOT treat unknown as blocked,
  // so a slow fetch never wrongly disables checkout for a legitimate cart.
  map: Record<number, Availability | undefined>;
  ensureLoaded: (id: number) => void;
}

const pending = new Set<number>();
let scheduled = false;

async function flush(set: (fn: (state: AvailabilityStore) => Partial<AvailabilityStore>) => void) {
  if (pending.size === 0) return;
  const ids = Array.from(pending);
  pending.clear();
  scheduled = false;
  try {
    const res = await fetch(`/api/products/availability?ids=${ids.join(',')}`);
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, Availability>;
    set(state => {
      const next = { ...state.map };
      for (const id of ids) {
        const v = data[String(id)];
        // Absent from the response ⇒ treat as available (don't block on a
        // partial/odd payload); explicit flags are honoured.
        next[id] = v ? { notForSale: !!v.notForSale, outOfStock: !!v.outOfStock } : { notForSale: false, outOfStock: false };
      }
      return { map: next };
    });
  } catch {
    // Network errors are non-fatal — lines stay "unknown" (not blocked). The
    // authoritative createOrder guard still refuses a blocked order.
  }
}

export const useAvailabilityStore = create<AvailabilityStore>((set, get) => ({
  map: {},
  ensureLoaded(id) {
    if (get().map[id] !== undefined) return;
    pending.add(id);
    if (!scheduled) {
      scheduled = true;
      // Batch every id requested in the current tick into one request.
      Promise.resolve().then(() => flush(set));
    }
  },
}));
