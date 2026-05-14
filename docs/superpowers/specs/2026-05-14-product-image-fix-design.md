# Product Image Fix — Design Spec

## Goal

Replace all 438 product images with correct, high-quality versions by combining ground-truth images extracted from the catalogue DOC file with higher-quality versions found via internet search.

## Background

- 438 products in `data/products.json`
- 382 products have original low-quality catalogue jpgs (~9KB each)
- 50 products have webp images downloaded by a previous Bing image-search script — some are wrong (e.g., "BARBIE SLIM" got the image 2 rows below it in the catalogue)
- 6 products have no image
- Source of truth: `APR2026- CATALOGUE.doc` (68MB, embedded product images at higher resolution)

## Architecture

Three-stage pipeline:

1. **DOC extraction** — extract all embedded images from the catalogue Word document
2. **Internet upgrade** — for each product, search for the official product page and download the main image if it is higher resolution than the DOC image
3. **Update** — write final images as `.webp` and update `data/products.json`

## Stage 1 — DOC Image Extraction

**Method:** Windows Word COM automation via PowerShell.

```powershell
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("C:\...\APR2026- CATALOGUE.doc")
# iterate $doc.InlineShapes, export each to temp/doc-images/extracted-N.png
$doc.Close(); $word.Quit()
```

**Fallback:** If Word is not installed, convert `.doc → .docx` using LibreOffice CLI, then unzip the `.docx` archive and pull `word/media/image*` files.

**Mapping:** The catalogue lists products in the same order as `products.json`. Non-product images (logos, category banners) are filtered out by aspect ratio: images wider than 2× their height are skipped. The remaining images map positionally — extracted image N → product N.

Output: `temp/doc-images/extracted-1.png` … `extracted-438.png`

## Stage 2 — Internet Search & Quality Upgrade

For each product:

1. Web search query: `"PRODUCT NAME" aesthetic medical product`
2. Fetch top 3 result pages
3. On each page: look for `og:image` meta tag, or the largest `<img>` element near an `<h1>`/`<h2>` containing the product name
4. Download the best internet candidate
5. Compare dimensions with the DOC-extracted image
6. Winner = whichever has larger pixel dimensions
7. Convert winner to `.webp`, quality 90, max 1600×1600 via `sharp`

**Fallback chain (per product):**
1. Internet image (correct + bigger) → use it
2. DOC extracted image → use it
3. Existing catalogue jpg → keep as-is (no regression)

**Why this beats the previous approach:** The old script searched Bing *image search* and matched product names in image URLs — but catalogue pages show multiple products, so the matched URL often contained the wrong product's image. The new approach finds the *product page* (whose title/h1 is the product name), guaranteeing the main image is the right product.

## Stage 3 — Update products.json

- Save each final image to `public/images/products/product-N.webp`
- Update `data/products.json`: set `image` field to `/images/products/product-N.webp`
- Print summary on completion: N from internet, N from DOC, N kept original

## Script Architecture

| File | Purpose |
|------|---------|
| `scripts/fix-product-images.ts` | Main orchestration — runs all 3 stages |
| `scripts/extract-doc-images.ps1` | Word COM extraction, outputs to `temp/doc-images/` |
| `scripts/progress.json` | Checkpoint file — tracks last completed product ID for resume |

**Rate limiting:** 1.5s delay between products to avoid IP blocks.

**Resume support:** Re-running the script reads `progress.json` and skips already-processed products.

## Tech Stack

- Node.js / TypeScript (ts-node) — main script
- PowerShell + Word COM — DOC image extraction
- `sharp` — image conversion and resizing to webp
- `node-fetch` / built-in `fetch` — HTTP requests
- Bing web search (HTML scraping) — product page discovery

## Success Criteria

- All 438 products have a `product-N.webp` image path in `products.json`
- No product has an image that belongs to a different product
- Images are at least 200×200px
- Script can be resumed after interruption without re-processing completed products
