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
  // Russian translations, entered by admin and stored on the product itself
  // (so they persist via the catalogue store). Empty/absent → English fallback.
  specification_ru?: string;
  description_ru?: string;
  indication_ru?: string;
  packaging_ru?: string;
  protocol_ru?: string;
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

// Product id → its category id, from the bundled catalogue (client-safe). Used
// by the checkout promo preview to know which lines a category-excluding code
// (e.g. MAISON15 skipping "imported-products") may discount. The authoritative
// recompute at order creation reads categoryId from the LIVE catalogue instead.
const PRODUCT_CATEGORY = new Map<number, string>(bundledProducts.map(p => [p.id, p.categoryId]));
export function categoryIdForProductId(id: number): string | null {
  return PRODUCT_CATEGORY.get(id) ?? null;
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

// Customer-facing label for a blocked product. Unavailable reads as "Out of
// stock" to shoppers (the admin's own wording stays "Available for order").
export function purchaseBlockLabel(reason: 'notForSale' | 'unavailable'): string {
  return reason === 'notForSale' ? 'Not for sale' : 'Out of stock';
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
//   1. the product's own RU field (new home, e.g. `description_ru`)
//   2. the legacy bundled translations file (fallback for not-yet-migrated rows)
//   3. the English value
function localized(
  product: Product,
  locale: string,
  field: keyof ProductTranslation,
  ruValue: string | undefined,
): string {
  if (locale === 'ru' && ruValue) return ruValue;
  const legacy = TRANSLATIONS[locale]?.[String(product.id)]?.[field];
  return legacy || (product[field] as string | undefined) || '';
}

export function getLocalizedDescription(product: Product, locale: string): string {
  return localized(product, locale, 'description', product.description_ru) || product.description;
}

export function getLocalizedSpecification(product: Product, locale: string): string {
  return localized(product, locale, 'specification', product.specification_ru) || product.specification;
}

export function getLocalizedIndication(product: Product, locale: string): string {
  return localized(product, locale, 'indication', product.indication_ru);
}

export function getLocalizedPackaging(product: Product, locale: string): string {
  return localized(product, locale, 'packaging', product.packaging_ru);
}

export function getLocalizedProtocol(product: Product, locale: string): string {
  return localized(product, locale, 'protocol', product.protocol_ru);
}
