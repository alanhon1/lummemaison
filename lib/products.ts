import productsData from '@/data/products.json';
import translationsRu from '@/data/translations/ru.json';
import translationsKo from '@/data/translations/ko.json';
import translationsFr from '@/data/translations/fr.json';
import translationsEs from '@/data/translations/es.json';

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
  fr: translationsFr as Record<string, ProductTranslation>,
  es: translationsEs as Record<string, ProductTranslation>,
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
  // Per-locale translations, entered by admin and stored on the product itself
  // (so they persist via the catalogue store). Empty/absent → bundled
  // translation file → English fallback. Suffix is the locale code, so
  // `localized()` resolves `${field}_${locale}` generically (ru/fr/es).
  specification_ru?: string;
  description_ru?: string;
  indication_ru?: string;
  packaging_ru?: string;
  protocol_ru?: string;
  specification_fr?: string;
  description_fr?: string;
  indication_fr?: string;
  packaging_fr?: string;
  protocol_fr?: string;
  specification_es?: string;
  description_es?: string;
  indication_es?: string;
  packaging_es?: string;
  protocol_es?: string;
  price: number;
  // Pre-discount "was" price shown struck-through next to `price`. Display only —
  // the customer always pays `price`. Absent / <= price ⇒ no discount shown.
  originalPrice?: number;
  tags: string[];
  // Purchase-time options chosen on the same product line (e.g. needle length
  // ['4mm','6mm','13mm']). NOT separate products — the choice rides on the cart
  // line and the order. Absent/empty ⇒ no selector shown.
  options?: string[];
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  notForSale?: boolean; // purchase disabled — reason: not for sale
  outOfStock?: boolean; // LEGACY purchase-disabled flag — kept in sync as the inverse of `available_for_order` for backward compatibility. Prefer `available_for_order`.
  // Admin "Available for order" master switch, INDEPENDENT of the real stock
  // count (oversell/preorder is allowed by design). true ⇒ customers can order
  // even when real stock is 0 (a preorder); false ⇒ buy button is disabled.
  // Undefined ⇒ fall back to the legacy `outOfStock` flag (see isAvailableForOrder).
  available_for_order?: boolean;
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

// Availability is admin-controlled and INDEPENDENT of the real stock count
// (oversell / preorder is allowed). `available_for_order` is the positive master
// switch; legacy `outOfStock` is its inverse. Undefined ⇒ resolve from the legacy
// flag so products saved before this field existed still behave correctly.
export function isAvailableForOrder(
  p: Pick<Product, 'available_for_order' | 'outOfStock'>,
): boolean {
  if (typeof p.available_for_order === 'boolean') return p.available_for_order;
  return !p.outOfStock;
}

// The single source of truth for whether the buy button is disabled and why.
// 'notForSale' = never sold; 'unavailable' = switched off for ordering. null =
// purchasable (which still includes stock-0 preorders).
export function purchaseBlockReason(
  p: Pick<Product, 'notForSale' | 'available_for_order' | 'outOfStock'>,
): 'notForSale' | 'unavailable' | null {
  if (p.notForSale) return 'notForSale';
  if (!isAvailableForOrder(p)) return 'unavailable';
  return null;
}

// Customer-facing label for a blocked product. Shoppers never see the admin
// wording — a not-for-sale product simply reads "Sold out" (button disabled),
// and unavailable reads "Out of stock".
export function purchaseBlockLabel(reason: 'notForSale' | 'unavailable'): string {
  return reason === 'notForSale' ? 'Sold out' : 'Out of stock';
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

// Resolution order for a localized field:
//   1. the product's own per-locale field (admin-entered, e.g. `description_fr`)
//   2. the bundled translations file for that locale (ru/ko/fr/es)
//   3. the English value
function localized(
  product: Product,
  locale: string,
  field: keyof ProductTranslation,
): string {
  const own = (product as unknown as Record<string, unknown>)[`${field}_${locale}`];
  if (typeof own === 'string' && own) return own;
  const legacy = TRANSLATIONS[locale]?.[String(product.id)]?.[field];
  return legacy || (product[field] as string | undefined) || '';
}

export function getLocalizedDescription(product: Product, locale: string): string {
  return localized(product, locale, 'description') || product.description;
}

export function getLocalizedSpecification(product: Product, locale: string): string {
  return localized(product, locale, 'specification') || product.specification;
}

export function getLocalizedIndication(product: Product, locale: string): string {
  return localized(product, locale, 'indication');
}

export function getLocalizedPackaging(product: Product, locale: string): string {
  return localized(product, locale, 'packaging');
}

export function getLocalizedProtocol(product: Product, locale: string): string {
  return localized(product, locale, 'protocol');
}
