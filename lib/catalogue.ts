import 'server-only';

import { loadProducts } from './catalogue-store';
import { createServiceClient } from '@/lib/supabase/server';
import type { Product } from './products';

// Server-only async product accessors backed by the live store
// (Supabase Storage, see catalogue-store.ts). Import these from server
// components / route handlers. Client components must not import this module —
// they use the sync helpers + bundled `categories` from '@/lib/products'.

export async function getAllProducts(): Promise<Product[]> {
  return loadProducts();
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return (await loadProducts()).find(p => p.id === id);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.categoryId === categoryId);
}

// New Arrivals: automatic — newest products first (higher id = added later).
export async function getNewProducts(limit = 8): Promise<Product[]> {
  return [...(await loadProducts())].sort((a, b) => b.id - a.id).slice(0, limit);
}

// Most Popular: automatic — ranked by real order volume (order_items quantity,
// cancelled orders excluded). Falls back to isBestSeller/first-N before any
// orders exist so the home section is never empty.
export async function getMostPopular(limit = 8): Promise<Product[]> {
  const products = await loadProducts();
  const byId = new Map(products.map(p => [p.id, p]));
  try {
    const supabase = createServiceClient();
    const [{ data: orders }, { data: items }] = await Promise.all([
      supabase.from('orders').select('id').neq('status', 'cancelled').not('order_number', 'ilike', 'TEST-%').limit(20000),
      supabase.from('order_items').select('order_id, product_id, quantity').limit(100000),
    ]);
    const activeIds = new Set((orders ?? []).map(o => o.id as number));
    const qty = new Map<number, number>();
    for (const it of items ?? []) {
      if (!activeIds.has(it.order_id as number)) continue;
      qty.set(it.product_id as number, (qty.get(it.product_id as number) ?? 0) + (it.quantity as number ?? 0));
    }
    const ranked = [...qty.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((p): p is Product => !!p);
    if (ranked.length > 0) return ranked.slice(0, limit);
  } catch {
    // fall through to fallback
  }
  const flagged = products.filter(p => p.isBestSeller);
  return (flagged.length > 0 ? flagged : products).slice(0, limit);
}

export async function getSaleProducts(limit = 8): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.isSale).slice(0, limit);
}

export async function getProductVariants(groupId: string): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.groupId === groupId).sort((a, b) => a.id - b.id);
}
