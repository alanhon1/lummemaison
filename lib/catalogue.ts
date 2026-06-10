import 'server-only';

import { loadProducts } from './catalogue-store';
import { loadHomeConfig } from './home-config';
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

// 전시 (Featured): admin-curated, ordered. Empty until set in "Manage 전시".
export async function getFeatured(limit = 8): Promise<Product[]> {
  const [products, cfg] = await Promise.all([loadProducts(), loadHomeConfig()]);
  const byId = new Map(products.map(p => [p.id, p]));
  return cfg.featured.map(id => byId.get(id)).filter((p): p is Product => !!p).slice(0, limit);
}

// Best Sellers: admin-curated ordered list ("Manage items"). Falls back to the
// legacy isBestSeller flag until an ordered list has been saved.
export async function getBestSellers(limit = 8): Promise<Product[]> {
  const [products, cfg] = await Promise.all([loadProducts(), loadHomeConfig()]);
  const byId = new Map(products.map(p => [p.id, p]));
  const ordered = cfg.bestSellers.map(id => byId.get(id)).filter((p): p is Product => !!p);
  if (ordered.length > 0) return ordered.slice(0, limit);
  return products.filter(p => p.isBestSeller).slice(0, limit);
}

// New Arrivals: automatic — newest products first (higher id = added later).
export async function getNewProducts(limit = 8): Promise<Product[]> {
  return [...(await loadProducts())].sort((a, b) => b.id - a.id).slice(0, limit);
}

export async function getSaleProducts(limit = 8): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.isSale).slice(0, limit);
}

export async function getProductVariants(groupId: string): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.groupId === groupId).sort((a, b) => a.id - b.id);
}
