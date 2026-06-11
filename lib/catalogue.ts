import 'server-only';

import { unstable_cache } from 'next/cache';
import { loadProducts } from './catalogue-store';
import { createServiceClient } from '@/lib/supabase/server';
import type { Product } from './products';

// Server-only async product accessors backed by the live store
// (Supabase Storage, see catalogue-store.ts). Import these from server
// components / route handlers. Client components must not import this module —
// they use the sync helpers + bundled `categories` from '@/lib/products'.

// "New" is fully automatic — there is NO manual New toggle. The newest
// NEW_LIMIT products by id (higher id = added later) are flagged isNew; once a
// product falls outside that window it stops being New. Any stored isNew value
// is overridden here.
const NEW_LIMIT = 40;

function applyAutoNew(products: Product[]): Product[] {
  const cutoff = [...products].map(p => p.id).sort((a, b) => b - a)[NEW_LIMIT - 1] ?? -Infinity;
  return products.map(p => ({ ...p, isNew: p.id >= cutoff }));
}

async function loadProductsWithNew(): Promise<Product[]> {
  return applyAutoNew(await loadProducts());
}

export async function getAllProducts(): Promise<Product[]> {
  return loadProductsWithNew();
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return (await loadProductsWithNew()).find(p => p.id === id);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return (await loadProductsWithNew()).filter(p => p.categoryId === categoryId);
}

// New Arrivals: automatic — newest products first (higher id = added later).
export async function getNewProducts(limit = 8): Promise<Product[]> {
  return [...(await loadProductsWithNew())].sort((a, b) => b.id - a.id).slice(0, limit);
}

// Product ids ranked by real order volume (order_items quantity; cancelled and
// TEST orders excluded). The two order/order_items reads are the only expensive
// part of "Most Popular", and they ran on every homepage render — cache the
// ranking for 10 min (popularity shifts slowly; no on-demand invalidation
// needed). Returns [] on no-orders / error so callers fall back. Product objects
// are mapped in by the caller from the already-cached product list, so admin
// edits still appear immediately.
const getPopularProductIds = unstable_cache(
  async (): Promise<number[]> => {
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
      return [...qty.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    } catch {
      return [];
    }
  },
  ['popular-product-ids'],
  { revalidate: 600 },
);

// Most Popular: automatic — ranked by real order volume (see getPopularProductIds).
// Falls back to isBestSeller/first-N before any orders exist so the home section
// is never empty.
export async function getMostPopular(limit = 8): Promise<Product[]> {
  const products = await loadProductsWithNew();
  const byId = new Map(products.map(p => [p.id, p]));
  const ranked = (await getPopularProductIds())
    .map(id => byId.get(id))
    .filter((p): p is Product => !!p);
  if (ranked.length > 0) return ranked.slice(0, limit);
  const flagged = products.filter(p => p.isBestSeller);
  return (flagged.length > 0 ? flagged : products).slice(0, limit);
}

export async function getSaleProducts(limit = 8): Promise<Product[]> {
  return (await loadProductsWithNew()).filter(p => p.isSale).slice(0, limit);
}

export async function getProductVariants(groupId: string): Promise<Product[]> {
  return (await loadProductsWithNew()).filter(p => p.groupId === groupId).sort((a, b) => a.id - b.id);
}
