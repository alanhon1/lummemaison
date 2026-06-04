import productsData from '@/data/products.json';
import translationsRu from '@/data/translations/ru.json';
import translationsKo from '@/data/translations/ko.json';

// Client-safe product module: types, the (bundled) category list, pure
// localization helpers, and structural group-range lookup.
//
// IMPORTANT: the LIVE product list is NOT here. Editable product data is served
// from the store in lib/catalogue-store.ts via the async accessors in
// lib/catalogue.ts (server-only). Import those from server components. This
// module stays synchronous and import-safe for client components.

type ProductTranslation = {
  description?: string;
  specification?: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
};

const TRANSLATIONS: Record<string, Record<string, ProductTranslation>> = {
  ru: translationsRu as Record<string, ProductTranslation>,
  ko: translationsKo as Record<string, ProductTranslation>,
};

export interface Category {
  id: string;
  name: string;
  range: [number, number];
}

export interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}

export interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
  price: number;
  tags: string[];
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  image: string;
  moq: number;
  enrichedInfo?: EnrichedInfo;
  groupId?: string;
  variantLabel?: string;
  images?: string[];
  groupName?: string;
  groupImage?: string;
}

// Categories stay bundled (rarely change; client components import this sync).
export const categories: Category[] = productsData.categories as Category[];

// Bundled product list — used ONLY for structural group-range lookup below and
// as the seed/fallback in catalogue-store.ts. Do not use for live reads.
const bundledProducts: Product[] = productsData.products as Product[];

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id);
}

const _groupRangeCache: Map<string, { min: number; max: number }> = (() => {
  const m = new Map<string, { min: number; max: number }>();
  for (const p of bundledProducts) {
    if (!p.groupId) continue;
    const cur = m.get(p.groupId);
    if (!cur) m.set(p.groupId, { min: p.id, max: p.id });
    else m.set(p.groupId, { min: Math.min(cur.min, p.id), max: Math.max(cur.max, p.id) });
  }
  return m;
})();

export function getGroupRange(groupId: string): { min: number; max: number } | null {
  return _groupRangeCache.get(groupId) ?? null;
}

export function getLocalizedDescription(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.description;
  return t || product.description;
}

export function getLocalizedSpecification(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.specification;
  return t || product.specification;
}

export function getLocalizedIndication(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.indication;
  return t || product.indication || '';
}

export function getLocalizedPackaging(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.packaging;
  return t || product.packaging || '';
}

export function getLocalizedProtocol(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.protocol;
  return t || product.protocol || '';
}
