'use client';

import { useEffect } from 'react';
import { useCartStore } from './store';
import { useAvailabilityStore, type Availability } from './availability-store';

export interface CartAvailabilityInfo {
  // Live availability for a cart line, or undefined while still loading.
  availabilityOf: (id: number) => Availability | undefined;
  // True once the product is KNOWN to be notForSale or outOfStock. Unknown
  // (still loading) is never "blocked" — we don't punish a legit cart for a
  // slow fetch. The authoritative block lives in createOrder.
  isBlocked: (id: number) => boolean;
  // 'Not for sale' / 'Out of stock' for a blocked line, else null. Matches the
  // hardcoded English labels used on the product card / detail page.
  blockLabelOf: (id: number) => string | null;
  // True if any line currently in the cart is known to be blocked.
  anyBlocked: boolean;
}

// Loads live notForSale/outOfStock flags for every cart line so the cart and
// checkout can flag (and refuse to check out) items that became unavailable
// after they were added to the persisted browser cart.
export function useCartAvailability(): CartAvailabilityInfo {
  const items = useCartStore(s => s.items);
  const map = useAvailabilityStore(s => s.map);
  const ensureLoaded = useAvailabilityStore(s => s.ensureLoaded);

  useEffect(() => {
    for (const i of items) ensureLoaded(i.id);
  }, [items, ensureLoaded]);

  const availabilityOf = (id: number) => map[id];
  const isBlocked = (id: number) => {
    const a = map[id];
    return !!a && (a.notForSale || a.outOfStock);
  };
  const blockLabelOf = (id: number) => {
    const a = map[id];
    if (!a) return null;
    if (a.notForSale) return 'Not for sale';
    if (a.outOfStock) return 'Out of stock';
    return null;
  };
  const anyBlocked = items.some(i => isBlocked(i.id));
  return { availabilityOf, isBlocked, blockLabelOf, anyBlocked };
}
