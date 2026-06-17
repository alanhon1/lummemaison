// Allowlist of product fields an admin request is permitted to set. Mirrors the
// editable fields of the `Product` interface in lib/products.ts (everything
// EXCEPT `id`, which the server always controls). Routes run incoming JSON
// through `pickProductFields` so a request cannot smuggle in arbitrary keys
// (mass assignment) or prototype-pollution keys like `__proto__` — anything not
// on this list is silently dropped. When you add a field to `Product`, add it
// here too so the admin editor can persist it.
export const ALLOWED_PRODUCT_FIELDS = [
  'name',
  'categoryId',
  'specification',
  'description',
  'indication',
  'packaging',
  'protocol',
  'specification_ru',
  'description_ru',
  'indication_ru',
  'packaging_ru',
  'protocol_ru',
  'price',
  'originalPrice',
  'tags',
  'options',
  'isNew',
  'isSale',
  'isBestSeller',
  'inStock',
  'notForSale',
  'outOfStock',
  'available_for_order',
  'image',
  'moq',
  'enrichedInfo',
  'groupId',
  'variantLabel',
  'images',
  'groupName',
  'groupImage',
] as const;

export function pickProductFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_PRODUCT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = src[key];
  }
  return out;
}
