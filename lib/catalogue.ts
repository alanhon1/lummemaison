import 'server-only';

import { loadProducts } from './catalogue-store';
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

export async function getBestSellers(limit = 8): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.isBestSeller).slice(0, limit);
}

export async function getNewProducts(limit = 8): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.isNew).slice(0, limit);
}

export async function getSaleProducts(limit = 8): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.isSale).slice(0, limit);
}

export async function getProductVariants(groupId: string): Promise<Product[]> {
  return (await loadProducts()).filter(p => p.groupId === groupId).sort((a, b) => a.id - b.id);
}
