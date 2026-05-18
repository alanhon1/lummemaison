# Spec: JotForm Product Photo Import

**Date**: 2026-05-18
**Status**: Approved (autonomous mode — user granted blanket permission to proceed)
**Scope batch**: Sub-project 1 of 2 (post-rebrand setup). Spec for sub-project 2 (enriched descriptions) is deferred until the content source is identified.

## Background

The prior project wiped every product image (commit `b2264d7`); all 438 products now have `image: ""`. The brand's canonical product catalog at https://form.jotform.com/shcoresteticsglobal/skin-global-product-order-form contains a photo for every product, organized by the same 20 categories as `data/products.json#categories`. The companion file `products.txt` (519 lines) is a clean canonical name+spec list that mirrors `products.json` by category and order — useful as a sanity check for the matching step.

The codebase already has three sitemap-style scrapers (`scripts/sync-from-aesthetics-shop.ts`, `scripts/sync-from-gofillerss.ts`, `scripts/fix-product-images.ts`) that follow the pattern: fetch external source → normalize names → fuzzy-match against `products.json` → download images via axios+sharp → update `image` field → emit audit report. The shared helpers live in `scripts/lib/fuzzy-match.ts` (`normalise` + `scoreMatch`). This spec adds a fourth scraper following the same pattern.

## Goals

1. Scrape the JotForm HTML, extracting each product's display name + photo URL.
2. Fuzzy-match every scraped entry to a product in `data/products.json` using the existing `scripts/lib/fuzzy-match.ts` helpers. Pick the highest-scoring match above a configurable threshold.
3. Download matched images, convert to webp (max 1024px, quality 85), and save to `public/images/products/product-<id>.webp`.
4. Update each matched product's `image` field in `data/products.json` to `/images/products/product-<id>.webp`. Back up the JSON to `data/backups/` first.
5. Emit `scripts/jotform-sync-report.txt` summarizing matches, unmatched JotForm entries, and `products.json` entries with no JotForm match.
6. Save the scrape result as `scripts/jotform-scrape.json` for audit/debug.

## Non-goals (YAGNI)

- Description, indication, packaging, or protocol fields. (Task #2 — separate spec, deferred.)
- Pricing import from JotForm. The existing `price` field in `products.json` stays.
- The `images` array (extra views). JotForm shows one photo per product; populate only the main `image` field.
- Admin UI or upload-flow changes. The existing admin `/api/admin/upload-image` route is untouched.
- Manual reordering or category remapping. JotForm category matches `products.json` category by name — but matching is by *product* name, not category, so cross-category mismatches are inherently filtered by the score threshold.
- Localized image variants. One image per product, used across all locales.

## Current state (verified 2026-05-18)

- `data/products.json` has 20 categories and 438 products. Every product has `image: ""` (post-wipe). 33 products have a `groupId` (so the catalogue dedupes them into 33 group cards plus solo products).
- `public/images/products/` is empty (only `.gitkeep`). The directory is preserved via `50f0ba0`.
- `products.txt` mirrors `products.json` by category: e.g. `(1) FILLERS (#1-70)` followed by 70 product names with specs. Names are upper- or mixed-case, often with trailing specs (`— 1.1 mL x 1 Syr, HA 24 mg/mL`).
- `scripts/lib/fuzzy-match.ts` provides `normalise` (lowercases, strips parens/punctuation) and `scoreMatch` (word-overlap score with long-word weighting). Both are already used by two production scrapers.
- WebFetch confirms the JotForm is server-rendered: each product appears in the raw HTML with name, price, image URL of pattern `https://www.jotform.com/uploads/shcoresteticsglobal/form_files/[filename].(jpg|png|webp)`. Approximate product count: 400-500, consistent with the 438 in `products.json`.
- `package.json` already has `axios`, `cheerio`, `sharp`, `tsx` — all dependencies needed.

## Design

Single script at `scripts/sync-from-jotform.ts`, modeled directly on `scripts/sync-from-aesthetics-shop.ts`. One commit total: script + npm-script entry + data backup + updated `products.json` + downloaded images + reports.

### Unit 1 — HTML fetch

Use `axios.get(JOTFORM_URL, { timeout: 60_000, headers: { 'User-Agent': '...' } })`. The URL is the JotForm public URL. The response body is the rendered HTML. Save the raw HTML to `scripts/jotform-raw.html` as an audit trail (gitignored or one-shot — see commit decision below).

### Unit 2 — Parse with cheerio

JotForm product widgets in this form type render as repeating DOM nodes. The plan task will exploratorily identify the right selector by inspecting the raw HTML — likely something like `li.form-product-item`, `div[data-type="product"]`, or similar. For each card, extract:
- Product name (text content of a label or heading element inside the card)
- Image URL (`<img>` `src` attribute inside the card)

Emit `JotformProduct[]` where `{ name: string, imageUrl: string }`. Filter entries with empty name or empty imageUrl.

If the selector doesn't isolate cards cleanly, fall back to extracting every image whose URL matches the JotForm uploads pattern, and walking up to find the nearest text node that looks like a product name.

### Unit 3 — Fuzzy match

For each `Product` in `products.json`:
1. Compute `normalise(product.name)`.
2. For each `JotformProduct`, compute `normalise(jp.name)` and `scoreMatch(productNormalised, jpNormalised)`.
3. Pick the highest-scoring jp. If score ≥ `THRESHOLD` (default 4), accept the match. Otherwise mark unmatched.

`THRESHOLD = 4` matches the convention in `sync-from-aesthetics-shop.ts`. Adjust during implementation if too lenient or too strict — the audit report is the feedback loop.

Each scraped JotformProduct can be claimed by at most one Product. Resolve conflicts by score — higher wins. Lower-scored Products with a stolen match fall back to their next-best JotformProduct.

### Unit 4 — Image download + webp conversion

For each matched product, download `imageUrl` via `axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 })`. Pipe through `sharp(buf).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(path)`.

Target path: `public/images/products/product-<id>.webp`. If `--force` is not set and the file already exists with non-zero size, skip download.

Brief delay between downloads (100ms) — same as siblings.

Failures: log and continue. Don't crash the whole run.

### Unit 5 — JSON update

After all downloads:
1. Read `data/products.json`, back up to `data/backups/products-<ISO-timestamp>.json`.
2. For each product with a successful download, set `image = '/images/products/product-<id>.webp'`.
3. Write back with `JSON.stringify(data, null, 2) + '\n'`.

### Unit 6 — Audit report

Write `scripts/jotform-sync-report.txt`:

```
JotForm sync — 2026-05-18T...
============================

JotForm products scraped: N
Products in products.json: 438

Matched: M / 438
Unmatched (products.json without a JotForm match): K
  - id 12, "CELOSOME MID" (Fillers)
  - ...
Unmatched (JotForm products with no products.json match): L
  - "Some product name" → https://jotform.com/uploads/...

Failed downloads: F
  - id 23 ("REGENOVUE FINE PLUS") — HTTP 404
```

### Unit 7 — Script entry and runtime

Add to `package.json` scripts: `"sync-from-jotform": "tsx scripts/sync-from-jotform.ts"`.

Run: `npm run sync-from-jotform`. Flags:
- `--force` — re-download even if local file exists
- `--dry-run` — scrape and match, but don't download or update JSON (just print the report)

## Implementation notes & risks

- **Anti-bot defenses.** JotForm may rate-limit or require a real browser. If `axios.get` returns a placeholder/error page instead of the form, fall back to a Playwright-style headless fetch — but only if needed (don't pre-build it). The WebFetch preview already saw real data, so the raw HTML path likely works.
- **Selector instability.** JotForm widgets evolve. The parsing logic should be tolerant: if the precise selector fails, fall back to "find every `<img>` whose src matches the uploads pattern, then look for nearby text." A regex-only fallback can also work.
- **Names with category context.** JotForm sometimes prefixes product names with category labels. Strip these via `normalise`.
- **The 33 grouped products share a `groupName`.** Each *variant* (Sosum S, M, L) is its own row in products.json with its own JotForm image. The script matches per-variant; group-level aggregation happens separately in the catalogue UI (already implemented).
- **`products.txt` as sanity check.** After matching, optionally check that every line in products.txt corresponds to a matched product. Output unmatched `products.txt` lines as a separate section of the audit report. Not blocking — informational.
- **First-run output sizing.** 438 webp files at <100 KB each = ~30-50 MB. Acceptable for `public/images/products/`.
- **Idempotence.** Re-running the script should be safe: skip already-downloaded images, re-emit the report. `--force` does a full refresh.

## Verification

After the script runs:

1. `scripts/jotform-sync-report.txt` exists. Skim the unmatched lists — should be small (target: <20 unmatched in either direction).
2. `public/images/products/` contains ~438 webp files (one per matched product).
3. `data/products.json`: spot-check three products. Their `image` fields should be `/images/products/product-<id>.webp`.
4. `data/backups/products-<timestamp>.json` exists with the pre-sync state.
5. `npm run build` succeeds. `npx tsc --noEmit` passes.
6. Manual: open `http://localhost:3000/en/product/1`, `http://localhost:3000/en/catalogue`. Photos render. Crossfade gallery still works.
7. Lint baseline unchanged (currently 70 problems).

## Follow-ups (out of scope)

- Spec 2: enriched descriptions (indication/packaging/protocol/description). Source TBD by user.
- Image fallback chain: if a product has no JotForm match, manually source from gofillerss or aesthetics-shop. Existing scripts cover that.
- A second pass for grouped products: pick the "best" variant's image as the group cover. The catalogue already handles this via `derive-group-display`, so re-run after the sync.
