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

// Admin write — upserts the row. Negative values are clamped to 0 so the
// UI cannot accidentally introduce a CHECK-violating row.
export async function setProductStock(productId: number, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert({ product_id: productId, stock: clamped }, { onConflict: 'product_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
