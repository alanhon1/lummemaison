// Server-side helpers for the product_stock table.
//
// Products are still defined in data/products.json (the catalogue is static);
// only the per-product `stock` counter lives in Supabase. Rows are created on
// first write — a missing row is treated as 0 stock.

import { createServiceClient } from '@/lib/supabase/server';

export type StockMap = Record<number, number>;

// Fetches stock for the given product ids in one query. Ids that don't have
// a row default to 0 in the returned map.
export async function getStockMap(productIds: number[]): Promise<StockMap> {
  if (productIds.length === 0) return {};
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, stock')
    .in('product_id', productIds);
  if (error) {
    console.error('[stock] getStockMap failed', error.message);
    return Object.fromEntries(productIds.map(id => [id, 0]));
  }
  const map: StockMap = {};
  for (const id of productIds) map[id] = 0;
  for (const row of data ?? []) {
    map[row.product_id as number] = row.stock as number;
  }
  return map;
}

export async function getProductStock(productId: number): Promise<number> {
  const map = await getStockMap([productId]);
  return map[productId] ?? 0;
}

export interface StockFlags {
  stock: number;
  wonder: boolean;
  stockUnknown: boolean;
}

// Reads stock + admin flags for the given ids. Missing rows default to
// { stock: 0, wonder: false, stockUnknown: false }.
export async function getStockFlagsMap(productIds: number[]): Promise<Record<number, StockFlags>> {
  const out: Record<number, StockFlags> = {};
  for (const id of productIds) out[id] = { stock: 0, wonder: false, stockUnknown: false };
  if (productIds.length === 0) return out;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, stock, wonder, stock_unknown')
    .in('product_id', productIds);
  if (error) {
    console.error('[stock] getStockFlagsMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    out[r.product_id as number] = {
      stock: (r.stock as number) ?? 0,
      wonder: Boolean(r.wonder),
      stockUnknown: Boolean(r.stock_unknown),
    };
  }
  return out;
}

// Admin write — upserts the row. Negative values are clamped to 0 so the
// UI cannot accidentally introduce a CHECK-violating row.
export async function setProductStock(productId: number, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert(
      { product_id: productId, stock: clamped, stock_unknown: false },
      { onConflict: 'product_id' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Toggles the admin-only "wonder" flag. Enabling it also marks stock unknown
// (the product's real stock isn't known yet → shows "???"). Disabling clears
// both the flag and the unknown state.
export async function setProductWonder(productId: number, wonder: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();
  // Enabling: mark wonder + unknown (stock resets to 0 / "???"). Disabling:
  // just clear the flags, leaving the current stock value intact.
  const { error } = wonder
    ? await supabase
        .from('product_stock')
        .upsert({ product_id: productId, wonder: true, stock_unknown: true, stock: 0 }, { onConflict: 'product_id' })
    : await supabase
        .from('product_stock')
        .upsert({ product_id: productId, wonder: false, stock_unknown: false }, { onConflict: 'product_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Deducts stock when payment is verified. Uses the atomic DB function
// decrement_stock_for_order (migration 005) which runs a single UPDATE with a
// CHECK constraint, preventing overselling even under concurrent requests.
export async function deductStockForItems(
  items: Array<{ product_id: number; quantity: number }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true };
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('decrement_stock_for_order', { items });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Restores stock after cancellation. Increments each product's stock by the
// cancelled quantity using read-then-write upserts (safe for boutique traffic).
export async function restoreStockForItems(
  items: Array<{ product_id: number; quantity: number }>,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = createServiceClient();
  const ids = items.map(i => i.product_id);
  const existing = await getStockMap(ids);
  for (const item of items) {
    const newStock = (existing[item.product_id] ?? 0) + item.quantity;
    await supabase
      .from('product_stock')
      .upsert({ product_id: item.product_id, stock: newStock }, { onConflict: 'product_id' });
  }
}
