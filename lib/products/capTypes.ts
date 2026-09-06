// Shared shape of the /api/products/caps answer.
//
// Deliberately its OWN module, imported by both the route handler and the
// client-side cap store. The store must never import from the route file: that
// pulls the route's server-only dependency chain (lib/supabase/server, which
// imports 'server-only') into a client module graph and breaks every page the
// store is mounted on.
//
// No stock number appears here on purpose — see app/api/products/caps/route.ts.

export type CapLimitReason = 'blocked' | 'stock' | 'perOrder' | null;

export interface CapAnswer {
  // May the customer add one more on top of the quantity they already hold?
  canAdd: boolean;
  // Is the quantity already above what we can supply? (never says by how much)
  mustReduce: boolean;
  // Nothing available at all for this (product, option).
  outOfStock: boolean;
  // Admin-set per-order policy limit (null = none). Safe to display.
  perOrder: number | null;
  // Which constraint is binding, so the UI can pick the right message.
  limitReason: CapLimitReason;
}
