// Server-side helpers for the product_stock table, keyed by (product_id, option).
// option = '' is the whole product (optionless) — unchanged from before migration
// 027. Products are defined in the live catalogue; only stock lives here.

import { createServiceClient } from '@/lib/supabase/server';
import { purchaseBlockReason, type Product } from '@/lib/products';

export type StockMap = Record<number, number>;
export interface StockKey { product_id: number; option?: string }
// `stock` is the PHYSICAL count on the shelf; `reserved` is how much of it is
// already committed to orders that have not been packed yet (migration 037).
// What a new customer may buy is stock - reserved — use availableOf(), never
// `stock` directly, on any customer-facing path.
export interface StockFlags { stock: number; reserved: number; wonder: boolean; stockUnknown: boolean }

// Units a new customer may order: physical stock minus what open orders hold.
export function availableOf(flags: StockFlags | undefined): number {
  if (!flags) return 0;
  return Math.max(0, Math.floor(flags.stock) - Math.floor(flags.reserved));
}

const k = (id: number, option: string) => `${id} ${option}`;
export function stockKey(productId: number, option = ''): string { return k(productId, option); }

// The orderable cap for one (product, option): the maximum quantity a customer
// may order. Single source of truth for the hard-cap rule — folds every block
// into one number:
//   - product missing (deleted), notForSale, or not available_for_order ⇒ 0
//   - option stock_unknown (real count not yet entered) ⇒ 0
//   - otherwise ⇒ the AVAILABLE integer, i.e. stock minus units already
//     reserved by open orders (0 ⇒ not orderable, request only), further
//     clamped by the product's optional max_per_order (per-order cap).
// NOTE: `wonder` is intentionally NOT a block. Per migration 026 it is a
// cosmetic admin-only label (purple "W"), never shown to customers and carrying
// no stock meaning — a wonder option still has a real stock count and is capped
// at that number like any other. (Blocking it would take ~45% of the live
// catalogue offline, since wonder is set on ~half of the stock rows.)
export function orderableCap(
  product: Pick<Product, 'notForSale' | 'available_for_order' | 'outOfStock' | 'max_per_order'> | undefined,
  flags: StockFlags | undefined,
): number {
  if (!product || purchaseBlockReason(product) !== null) return 0;
  if (!flags || flags.stockUnknown) return 0;
  const stockCap = availableOf(flags);
  const perOrder = perOrderLimit(product);
  return perOrder === null ? stockCap : Math.min(stockCap, perOrder);
}

// The per-order quantity cap set by the admin, or null when unlimited (absent /
// 0 / non-positive). Exposed so the cart UI can show a "Limited to N per order"
// message distinct from the "only N in stock" one — the number alone can't say
// which constraint is binding.
export function perOrderLimit(product: Pick<Product, 'max_per_order'> | undefined): number | null {
  const v = product?.max_per_order;
  return typeof v === 'number' && v > 0 ? Math.floor(v) : null;
}

// Per-product total stock (summed across all options). Used by procurement and
// the public stock endpoint where option granularity doesn't matter.
export async function getStockMap(productIds: number[]): Promise<StockMap> {
  const out: StockMap = {};
  for (const id of productIds) out[id] = 0;
  if (productIds.length === 0) return out;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, stock')
    .in('product_id', productIds);
  if (error) {
    console.error('[stock] getStockMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    out[r.product_id as number] = (out[r.product_id as number] ?? 0) + ((r.stock as number) ?? 0);
  }
  return out;
}

// Stock + admin flags for specific (product_id, option) keys. Missing rows
// default to { stock: 0, wonder: false, stockUnknown: false }. Key the result
// with stockKey(productId, option).
export async function getStockFlagsMap(keys: StockKey[]): Promise<Record<string, StockFlags>> {
  const out: Record<string, StockFlags> = {};
  for (const key of keys) out[k(key.product_id, key.option ?? '')] = { stock: 0, reserved: 0, wonder: false, stockUnknown: false };
  if (keys.length === 0) return out;
  const supabase = createServiceClient();
  const ids = [...new Set(keys.map(key => key.product_id))];
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, option, stock, reserved, wonder, stock_unknown')
    .in('product_id', ids);
  if (error) {
    console.error('[stock] getStockFlagsMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    out[k(r.product_id as number, (r.option as string) ?? '')] = {
      stock: (r.stock as number) ?? 0,
      reserved: (r.reserved as number) ?? 0,
      wonder: Boolean(r.wonder),
      stockUnknown: Boolean(r.stock_unknown),
    };
  }
  return out;
}

// Per-product AVAILABLE units (stock - reserved, summed across options). This is
// the customer-facing counterpart to getStockMap, which reports the physical
// count for admin/procurement. Never expose either number to the client — see
// /api/products/availability, which reduces this to a boolean.
export async function getAvailableMap(productIds: number[]): Promise<StockMap> {
  const out: StockMap = {};
  for (const id of productIds) out[id] = 0;
  if (productIds.length === 0) return out;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, stock, reserved')
    .in('product_id', productIds);
  if (error) {
    console.error('[stock] getAvailableMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    const avail = Math.max(0, ((r.stock as number) ?? 0) - ((r.reserved as number) ?? 0));
    out[r.product_id as number] = (out[r.product_id as number] ?? 0) + avail;
  }
  return out;
}

// Every option row for a product (for the admin per-option editor).
export async function getProductOptionStock(
  productId: number,
): Promise<Array<{ option: string; stock: number; reserved: number; wonder: boolean; stockUnknown: boolean }>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('option, stock, reserved, wonder, stock_unknown')
    .eq('product_id', productId);
  if (error) {
    console.error('[stock] getProductOptionStock failed', error.message);
    return [];
  }
  return (data ?? []).map(r => ({
    option: (r.option as string) ?? '',
    stock: (r.stock as number) ?? 0,
    reserved: (r.reserved as number) ?? 0,
    wonder: Boolean(r.wonder),
    stockUnknown: Boolean(r.stock_unknown),
  }));
}

export async function getProductStock(productId: number, option = ''): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('product_stock')
    .select('stock')
    .eq('product_id', productId)
    .eq('option', option)
    .maybeSingle();
  return (data?.stock as number | undefined) ?? 0;
}

// Admin write — sets a known stock for one (product_id, option) and clears the
// "unknown" + "wonder" flags (entering a real count means it's no longer
// unknown/wonder). Negative clamped to 0.
export async function setProductStock(productId: number, option: string, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert({ product_id: productId, option, stock: clamped, stock_unknown: false, wonder: false }, { onConflict: 'product_id,option' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type StockItem = { product_id: number; quantity: number; option?: string };

const rpcPayload = (items: StockItem[]) =>
  items.map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option ?? '' }));

// Reserves stock at ORDER CREATION (migration 037). Atomic across all lines —
// either every line is reserved or none is, so a half-reserved order can't
// exist. Fails when any line can't be covered by stock - reserved, which is the
// oversell gate: two customers racing for the last unit serialise in the RPC
// and exactly one wins.
export async function reserveStockForOrder(
  orderId: number,
  items: StockItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true };
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('reserve_stock_for_order', {
    p_order_id: orderId,
    items: rpcPayload(items),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Releases a reservation without touching physical stock — used when an order is
// cancelled or rolled back BEFORE it was packed, and by the 7-day expiry sweep.
// Idempotent: a no-op when the order holds no reservation.
export async function releaseReservationForOrder(
  orderId: number,
  items: StockItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('release_reservation_for_order', {
    p_order_id: orderId,
    items: rpcPayload(items),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Converts a reservation into a real decrement when the order reaches packing —
// the units physically leave the shelf. Orders created before migration 037
// hold no reservation, so the RPC falls back to a plain floor-checked decrement
// for them (identical to the pre-037 behaviour).
export async function commitReservationForOrder(
  orderId: number,
  items: StockItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true };
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('commit_reservation_for_order', {
    p_order_id: orderId,
    items: rpcPayload(items),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Restores physical stock after a cancellation that happened AFTER packing.
// Atomic per row via the RPC (migration 037) — the previous read-then-write
// could silently lose a concurrent update.
export async function restoreStockForItems(items: StockItem[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('restore_stock_for_order', { items: rpcPayload(items) });
  if (error) console.error('[stock] restore_stock_for_order failed', error.message);
}
