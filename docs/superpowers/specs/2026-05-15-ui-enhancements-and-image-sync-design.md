# UI Enhancements + aesthetics-shop.com Image Sync — Design

**Date:** 2026-05-15  
**Status:** Approved

## Scope

Three independent work streams, all approved together.

---

## A. Product Card Hover Zoom

**File:** `components/catalogue/ProductCard.tsx`

Current: `group-hover:scale-105` on the image (subtle, user wants more visible).  
Change to: `group-hover:scale-110`. No other structural change — overflow-hidden and transition already in place.

---

## B. aesthetics-shop.com Image Sync Script

**File:** `scripts/sync-from-aesthetics-shop.ts`  
**Package.json:** add `"sync-aesthetics": "tsx scripts/sync-from-aesthetics-shop.ts"`

### Flow
1. Fetch `https://aesthetics-shop.com/product-sitemap.xml` via `axios`
2. Parse XML with regex to extract all `<loc>` (product URL → derive name from slug) and `<image:loc>` (first image per product)
3. Build `Map<normalizedName, firstImageUrl>` (~125 products)
4. For each product in `products.json`:
   - Normalize name (lowercase, strip units like "100 units"/"100u", strip special chars)
   - Score word-overlap against the aesthetics-shop map (same approach as `sync-product-images.ts`)
   - Skip if score = 0 (no match)
5. For matched products: download image via `axios` → process with `sharp` → WebP 1200×1200 max → save as `public/images/products/product-{id}.webp?` (clean filename, no query string)
6. Update `products.json` image field to `/images/products/product-{id}.webp`
7. Print progress + write `scripts/aesthetics-sync-report.txt`

### Matching normalization
- `"BOTULAX 100 units"` → `"botulax 100"`
- `"Botulax 100U"` → `"botulax 100"`  
- Strip: CE, NO, Lidocaine in parens, mL counts, syringe counts

### Skip condition
Products that already have a non-empty image path are skipped by default (add `--force` flag to overwrite all).

---

## C. Home Page UI Enhancements

### C1. Hero — Animated Floating Orbs

**File:** `components/home/Hero.tsx`

Add 3 decorative circles with Framer Motion infinite float animations in the hero background. Different sizes, positions, speeds — give depth to the dark hero. Replace/augment the current static `bg-gold/5 rounded-full blur-3xl` div.

```
Orb 1: top-1/4 right-1/4, w-64 h-64, gold/8, float y: 0→-30→0, 8s loop
Orb 2: bottom-1/3 right-1/6, w-96 h-96, gold/5, float y: 0→20→0, 11s loop  
Orb 3: top-1/2 right-1/3, w-32 h-32, gold/12, float y: 0→-15→0, 6s loop
```

All: `rounded-full blur-3xl pointer-events-none absolute`

### C2. Category Grid — Circular Card Style

**File:** `components/home/CategoryGrid.tsx`

Transform the rectangular border cards to a circular pill/orb style:
- Container: `rounded-full` with gold border and soft background
- Icon centered inside circle, slightly larger
- Name below the circle (not inside)
- Hover: `scale-105` on circle + gold glow shadow (`shadow-gold`)
- Keep existing Framer Motion scroll-in stagger

Visual change: from flat rectangle → floating circle with name underneath, inspired by aesthetics-shop.com's circular category thumbnails.

---

## Files Changed

| File | Change |
|------|--------|
| `components/catalogue/ProductCard.tsx` | scale-105 → scale-110 |
| `components/home/Hero.tsx` | Add 3 animated floating orbs |
| `components/home/CategoryGrid.tsx` | Circular card style |
| `scripts/sync-from-aesthetics-shop.ts` | New image sync script |
| `package.json` | Add sync-aesthetics script |
