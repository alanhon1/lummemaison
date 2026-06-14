// Server-side helpers for the product_stock table, keyed by (product_id, option).
// option = '' is the whole product (optionless) — unchanged from before migration
// 027. Products are defined in the live catalogue; only stock lives here.

import { createServiceClient } from '@/lib/supabase/server';

export type StockMap = Record<number, number>;
export interface StockKey { product_id: number; option?: string }
export interface StockFlags { stock: number; wonder: boolean; stockUnknown: boolean }

const k = (id: number, option: string) => `${id} ${option}`;
export function stockKey(productId: number, option = ''): string { return k(productId, option); }

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
  for (const key of keys) out[k(key.product_id, key.option ?? '')] = { stock: 0, wonder: false, stockUnknown: false };
  if (keys.length === 0) return out;
  const supabase = createServiceClient();
  const ids = [...new Set(keys.map(key => key.product_id))];
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, option, stock, wonder, stock_unknown')
    .in('product_id', ids);
  if (error) {
    console.error('[stock] getStockFlagsMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    out[k(r.product_id as number, (r.option as string) ?? '')] = {
      stock: (r.stock as number) ?? 0,
      wonder: Boolean(r.wonder),
      stockUnknown: Boolean(r.stock_unknown),
    };
  }
  return out;
}

// Every option row for a product (for the admin per-option editor).
export async function getProductOptionStock(
  productId: number,
): Promise<Array<{ option: string; stock: number; wonder: boolean; stockUnknown: boolean }>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('option, stock, wonder, stock_unknown')
    .eq('product_id', productId);
  if (error) {
    console.error('[stock] getProductOptionStock failed', error.message);
    return [];
  }
  return (data ?? []).map(r => ({
    option: (r.option as string) ?? '',
    stock: (r.stock as number) ?? 0,
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
// "unknown" flag. Negative clamped to 0.
export async function setProductStock(productId: number, option: string, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert({ product_id: productId, option, stock: clamped, stock_unknown: false }, { onConflict: 'product_id,option' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Admin-only wonder flag per (product_id, option). Enabling marks stock unknown
// (???); disabling clears both flags.
export async function setProductWonder(productId: number, option: string, wonder: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = wonder
    ? await supabase.from('product_stock').upsert(
        { product_id: productId, option, wonder: true, stock_unknown: true, stock: 0 }, { onConflict: 'product_id,option' })
    : await supabase.from('product_stock').upsert(
        { product_id: productId, option, wonder: false, stock_unknown: false }, { onConflict: 'product_id,option' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Deducts stock when payment is verified, per (product_id, option), via the
// atomic decrement_stock_for_order RPC (migration 027, option-aware).
export async function deductStockForItems(
  items: Array<{ product_id: number; quantity: number; option?: string }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true };
  const supabase = createServiceClient();
  const payload = items.map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option ?? '' }));
  const { error } = await supabase.rpc('decrement_stock_for_order', { items: payload });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Restores stock after cancellation, per (product_id, option). Read-then-write
// upserts (safe for boutique traffic).
export async function restoreStockForItems(
  items: Array<{ product_id: number; quantity: number; option?: string }>,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = createServiceClient();
  for (const item of items) {
    const opt = item.option ?? '';
    const { data: row } = await supabase
      .from('product_stock').select('stock').eq('product_id', item.product_id).eq('option', opt).maybeSingle();
    const newStock = ((row?.stock as number | null) ?? 0) + item.quantity;
    await supabase.from('product_stock')
      .upsert({ product_id: item.product_id, option: opt, stock: newStock }, { onConflict: 'product_id,option' });
  }
}
