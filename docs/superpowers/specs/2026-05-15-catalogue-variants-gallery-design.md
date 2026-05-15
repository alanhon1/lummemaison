# Catalogue Upgrade: Variants, Gallery & Descriptions

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Upgrade the Lumière catalogue to match aesthetics-shop.com's UX:
- Group variant products (SOSUM S/M/H → one card with "Choose an option")
- Multi-image gallery on product detail (2–4 photos)
- Short descriptions scraped from aesthetics-shop.com
- Lumière theme preserved throughout

Scope: only products in `products.txt` that exist on aesthetics-shop.com.

---

## Data Schema

Add four optional fields to each product in `data/products.json`:

```ts
interface Product {
  // existing fields unchanged...
  groupId?: string;       // shared key for variants, e.g. "sosum"
  variantLabel?: string;  // option name in selector, e.g. "S" | "100U" | "Soft"
  images?: string[];      // extra image paths beyond the main `image`
  description?: string;   // short description (2–3 sentences)
}
```

Products without `groupId` are standalone and unaffected.

---

## Scripts (run once)

### 1. `scripts/group-products.ts`

- Re-runs the name-matching logic from `sync-from-aesthetics-shop.ts`
- Products that match the **same aesthetics-shop.com slug** → same `groupId`
- `variantLabel` = remainder after stripping the common group-name prefix
  - "SOSUM S" → label `"S"`, groupId `"sosum"`
  - "BOTULAX 100" → label `"100U"`, groupId `"botulax"`
- Writes `groupId` + `variantLabel` back to `data/products.json`
- Prints grouping report to console

### 2. `scripts/scrape-descriptions.ts`

- For each unique aesthetics-shop.com product URL (one per groupId), fetch page HTML
- Extract description: first `<p>` inside `.woocommerce-product-details__short-description` or equivalent selector
- Truncate to ~200 chars / 2–3 sentences
- Write `description` to all products sharing that `groupId`

### 3. `scripts/scrape-gallery-images.ts`

- For each unique aesthetics-shop.com product URL, scrape gallery image URLs
- Download up to 3 extra images, process with sharp → WebP 1200×1200 max
- Save as `public/images/products/product-{id}-2.webp`, `-3.webp`, `-4.webp`
- Write `images[]` array to the primary product of each group

---

## Catalogue Page

**File:** `app/[locale]/catalogue/page.tsx` (or CatalogueClient)

- After loading products, deduplicate: for each `groupId`, keep only the product with the lowest `id` (primary)
- Standalone products (no `groupId`) are unaffected
- Pass `variantCount` to ProductCard

**ProductCard additions:**
- If `variantCount > 1`, show a small "N options" pill below the product name
- Otherwise unchanged

---

## Product Detail Page

**File:** `app/[locale]/product/[id]/page.tsx` + `ProductDetailClient`

### Image Gallery

- If `product.images` has entries, show a gallery: main image + thumbnails below
- Clicking a thumbnail swaps the main image (no full-screen modal needed)
- Max 4 images shown

### Variant Selector

- On load, fetch all sibling products (same `groupId`) from products.json
- If siblings exist, render a `<select>` / styled dropdown: "Choose an option"
- Each option: `{variantLabel} – {formatPrice(variant.price)}`
- Default = current product (the URL's id)
- Selecting a variant → `router.push(`/${locale}/product/${variant.id}`)`

### Description

- If `product.description` is set, render below the specs
- Styled as a subtle paragraph in the Lumière gold/charcoal palette

---

## Cart

No changes. Each variant has its own product ID; the cart item already captures the exact variant chosen.

---

## Implementation Order

1. Scripts: group → descriptions → gallery images (data must be ready before UI)
2. `lib/products.ts`: update `Product` type
3. Catalogue: deduplication + "N options" pill
4. Product detail: gallery + variant selector + description

---

## Out of Scope

- Inventory / stock tracking per variant
- Pricing rules / bulk discounts
- Admin UI for managing variant groups (manual JSON editing is sufficient for now)
