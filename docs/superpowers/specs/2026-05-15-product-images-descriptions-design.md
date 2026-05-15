# Product Images & Descriptions Population

**Date:** 2026-05-15  
**Status:** Approved

## Goal

Two independent tasks:
1. Copy product images from `lumeemasonpic/catalogue/categories/` into the web-served `public/images/products/` folder and update `products.json` image paths.
2. Populate the `description` field for all 438 products using the already-parsed PDF (`lumeemasonpic/pdf-content.txt`), supplemented by web search for products with minimal PDF descriptions.

No git push until the user explicitly requests it.

---

## Task 1 — Image Integration

### Source Structure

```
lumeemasonpic/catalogue/categories/
  <cat-slug>/           e.g. catalogue-categories-fillers
    <brand-slug>/       e.g. regenovue
      <image-file>      e.g. Regenovue-deep-fine_1.webp
```

326 images total across 20 category folders.

### Category Slug → categoryId Mapping

| Folder suffix | categoryId |
|---|---|
| fillers | fillers |
| mesotherapy-biorevitalization | mesotherapy |
| acne-treatment | acne-treatment |
| hair-treatment | hair-treatment |
| pharmacy-favourites | pharmacy-favourites |
| topical-cosmetics | topical-cosmetics |
| intimate-care | intimate-care |
| growth-factor-exosome | growth-factor-exosome |
| curenex | curenex |
| dermagen | dermagen |
| gtm | gtm |
| equipment | equipment |
| salon-grade | salon-grade |
| lipolytics | lipolytics |
| botulinum-therapy | botulinum |
| injections | injections |
| anesthetics | anesthetics |
| placental-therapy | placental-therapy |
| nano-needle-cannula | nano-needle-cannula |
| imported-products | imported-products |

### Matching Logic (per product)

1. Find the category folder for the product's `categoryId`.
2. Convert product name to slug: lowercase, strip special chars, spaces → hyphens.  
   e.g. `"REGENOVUE FINE (CE)"` → `"regenovue-fine-ce"`
3. Match attempts (in order):
   - **Exact folder match**: slug equals a brand folder name
   - **Prefix match**: slug starts with a brand folder name (e.g. `"regenovue-fine-ce"` → `"regenovue"`)
   - **Image filename match**: any image filename (without extension) contains the product slug
   - **Brand folder fallback**: take the first image in the best-matching brand folder
4. When a brand folder contains multiple images, prefer the image whose filename best matches the product name substring (longest common subsequence heuristic).

### Output

- Images copied to `public/images/products/product-<id>.<ext>` (preserving original extension).
- `products.json` `image` field updated to `/images/products/product-<id>.<ext>`.
- Products with no match retain their existing image path unchanged.
- `scripts/image-sync-report.txt` written with three sections:
  - Matched (id, product name, source image)
  - Fallback used (id, product name, source image, reason)
  - Unmatched (id, product name — kept existing image)

### Script

`scripts/sync-product-images.ts`  
Run with: `npx ts-node scripts/sync-product-images.ts`

---

## Task 2 — Description Population

### Source 1: pdf-content.txt

Already extracted. Format per page entry:
```
<number>. <PRODUCT NAME>  <specification>  <description text>  $<price>
```

Parsing strategy:
- Split by product number pattern `\n(\d+)\.\s`
- For each entry, extract the description text (everything after specification, before price)
- Index by product number (matches `products.json` `id`)

### Thresholds

| Condition | Action |
|---|---|
| Extracted description ≥ 60 chars | Use PDF description directly |
| Extracted description < 60 chars | Flag for web search |
| No match found | Flag for web search |

Expected: ~300 products use PDF directly, ~138 need web search (mainly simple HA fillers).

### Source 2: Web Search (for flagged products)

Search query: `"<product name>" filler description site:manufacturer OR site:aesthetic`  
Extract: first meaningful paragraph from product manufacturer or distributor page.  
Language: English only (i18n handles translation for other locales).

### Script

`scripts/fill-descriptions.ts`  
Run with: `npx ts-node scripts/fill-descriptions.ts`

Outputs:
- Updated `data/products.json` description fields
- `scripts/description-report.txt` listing: PDF-sourced count, web-sourced count, failed count

---

## Execution Order

1. Run `sync-product-images.ts` → review `image-sync-report.txt`
2. Run `fill-descriptions.ts` → review `description-report.txt`
3. Manually verify a sample of 10–20 products in the admin UI
4. Git commit when satisfied (no push until explicitly requested)

---

## Constraints

- Do not modify `lumeemasonpic/` contents.
- Do not push to git.
- Keep existing image paths for unmatched products (do not set to null/empty).
- Descriptions stored in English in `products.json`; i18n translation is handled by the existing translation layer.
