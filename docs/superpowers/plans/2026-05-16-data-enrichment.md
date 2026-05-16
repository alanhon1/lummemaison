# Data Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit all 438 product image matches via Claude Code subagent vision, clear mismatches, refill from mg.gofillerss.com as a secondary source, generate `public/missingproducts.txt` for what still cannot be enriched, and add `groupName`/`groupImage` to the 33 product groups for cleaner deduplicated catalog cards.

**Architecture:** Three sequential phases. Phase 1 runs a one-time vision audit using nested subagent dispatch (the implementer subagent for the audit task spawns ~15 vision worker sub-subagents in batches of 30 images each, each batch using the `Read` tool to view local product image files and classifying each as CONFIRMED/MISMATCH/UNCERTAIN). Phase 2 scrapes gofillerss.com (Shopify, uses `sitemap_products_1.xml`) for missing data, stages candidates, then runs the same subagent vision pass to verify them before promoting. Phase 3 derives group-level display fields from the cleaned data and updates a single React component.

**Tech Stack:** Next.js 16.2.6, TypeScript 5, `axios` (already installed), `cheerio` (already installed), `sharp` (already installed), `tsx` (already installed, runs TS scripts). No API keys, no new dependencies. Vision verification handled by Claude Code subagent dispatch — no external API calls.

**Spec:** `docs/superpowers/specs/2026-05-16-data-enrichment-design.md` (commits `6061c37` + `f9b7a98`)

**Pre-flight assumptions verified before writing this plan:**
- `mg.gofillerss.com` exists, runs Shopify, exposes `https://mg.gofillerss.com/sitemap.xml` as a sitemap index pointing to `sitemap_products_1.xml?from=...&to=...`.
- Shopify product URLs follow `/products/{slug}` (not `/product/`) and image URLs are typically `cdn.shopify.com/...`.
- All 438 products are loadable; 427 have an image path, 11 don't. Image files live under `public/images/products/product-{id}.webp`.

---

## File Structure

**New files:**
- `scripts/lib/fuzzy-match.ts` — shared name normalisation + scoring (extracted from `sync-from-aesthetics-shop.ts`)
- `scripts/audit-prep.ts` — splits products with images into batches of 30, writes `scripts/audit-batches/batch-{n}.json`
- `scripts/audit-apply.ts` — reads `scripts/audit-results.json`, mutates `data/products.json` (clears MISMATCH+UNCERTAIN images), writes `scripts/audit-report.txt` + backup
- `scripts/sync-from-gofillerss.ts` — parses gofillerss Shopify sitemap, returns parsed product entries (slug, name, imageUrl). Mirrors `sync-from-aesthetics-shop.ts`'s structure but adapted for Shopify.
- `scripts/refill-from-secondary.ts` — orchestrator: for every product with empty image or short description, fuzzy-match against gofillerss, download staging image to `product-{id}-secondary.webp`, capture candidate description. Writes `scripts/secondary-candidates.json`.
- `scripts/refill-apply.ts` — reads `scripts/secondary-candidates.json` and vision-verification results, promotes CONFIRMED stagings to `product-{id}.webp`, deletes REJECTED stagings, writes verified descriptions.
- `scripts/missing-products.ts` — reads `data/products.json` post-Phase-2 and emits `public/missingproducts.txt`.
- `scripts/derive-group-display.ts` — computes `groupName` + `groupImage` per group, writes back into `products.json`.

**Modified files:**
- `scripts/sync-from-aesthetics-shop.ts` — refactor to import shared helpers from `scripts/lib/fuzzy-match.ts` (zero behavior change)
- `components/catalogue/ProductCard.tsx` — when card represents a group, render `groupName` + `groupImage` instead of `name` + `image`
- `data/products.json` — receives mutations from audit-apply, refill-apply, and derive-group-display
- `package.json` — add `npm run` scripts for the new entry points

**Working directories (created during execution, gitignored):**
- `scripts/audit-batches/` (15 batch JSON files written by audit-prep)
- `scripts/audit-results.json` (concatenated subagent classifications)
- `scripts/secondary-candidates.json` (Phase 2 staging manifest)
- `public/images/products/product-{id}-secondary.webp` (Phase 2 staging images — promoted or deleted)

**Add to `.gitignore`:**
- `scripts/audit-batches/`
- `scripts/audit-results.json`
- `scripts/secondary-candidates.json`
- `public/images/products/product-*-secondary.webp`

---

## Task 1: Extract shared fuzzy-match helpers

**Files:**
- Create: `scripts/lib/fuzzy-match.ts`
- Modify: `scripts/sync-from-aesthetics-shop.ts` (replace inline functions with imports)

The existing `sync-from-aesthetics-shop.ts` and `group-products.ts` both define identical `normalise()` and `scoreMatch()` functions. Phase 2's new `sync-from-gofillerss.ts` will need the same. Extract them once.

- [ ] **Step 1: Create `scripts/lib/` directory and write the shared module**

Create `scripts/lib/fuzzy-match.ts` with this exact content:

```ts
/**
 * Shared fuzzy product-name matching used by aesthetics-shop and gofillerss
 * scrapers and by group-products. One canonical implementation.
 */

/** Lowercase and strip noise (parens, "units", punctuation, etc). */
export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(\d+)\s*u\b/g, '$1')
    .replace(/\bunits?\b/g, '')
    .replace(/\bwith\b/g, '')
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score how many normalised words two names share. Long words count double. */
export function scoreMatch(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = b.split(' ').filter(w => w.length > 1);
  let score = 0;
  for (const w of wb) {
    if (wa.has(w)) score += w.length > 3 ? 2 : 1;
  }
  return score;
}
```

- [ ] **Step 2: Update `scripts/sync-from-aesthetics-shop.ts` to import from the shared module**

Find the two function definitions (`function normalise(name: string)` around line 35 and `function scoreMatch(a: string, b: string)` around line 49) and delete them entirely. Add this import at the top of the file (after the existing `import sharp from 'sharp';`):

```ts
import { normalise, scoreMatch } from './lib/fuzzy-match';
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages. The script change does not affect the Next.js build but a clean build confirms TypeScript still type-checks across the project.

- [ ] **Step 4: Commit**

```
git add scripts/lib/fuzzy-match.ts scripts/sync-from-aesthetics-shop.ts
git commit -m "refactor(scripts): extract fuzzy-match helpers into scripts/lib"
```

---

## Task 2: Audit-prep — batch products for vision review

**Files:**
- Create: `scripts/audit-prep.ts`
- Modify: `package.json` (add `audit-prep` npm script)
- Modify: `.gitignore` (add the working files)

This script reads `data/products.json`, picks every product that currently has an `image` field, splits them into batches of 30, and writes each batch to `scripts/audit-batches/batch-{n}.json`. The vision worker subagents (Task 3) consume these files.

- [ ] **Step 1: Add gitignore entries**

Edit `.gitignore` and append at the end:

```
# Spec 2 data-enrichment intermediates (regenerated on every run)
scripts/audit-batches/
scripts/audit-results.json
scripts/secondary-candidates.json
public/images/products/product-*-secondary.webp
```

- [ ] **Step 2: Create `scripts/audit-prep.ts`**

Write to `scripts/audit-prep.ts`:

```ts
/**
 * Splits products with an existing image into batches of 30 for
 * Phase 1 vision audit. Outputs scripts/audit-batches/batch-{n}.json,
 * where each entry has the absolute path the vision subagent will Read.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUT_DIR = path.join(process.cwd(), 'scripts', 'audit-batches');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BATCH_SIZE = 30;

interface Category { id: string; name: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface BatchEntry {
  id: number;
  name: string;
  categoryName: string;
  imagePath: string;
}

function main(): void {
  const data: { categories: Category[]; products: Product[] } =
    JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  const eligible = data.products
    .filter(p => p.image && typeof p.image === 'string' && p.image.length > 0)
    .map<BatchEntry>(p => {
      const imageBasename = p.image.replace(/^\/images\/products\//, '');
      return {
        id: p.id,
        name: p.name,
        categoryName: catName.get(p.categoryId) ?? p.categoryId,
        imagePath: path.join(IMAGE_DIR, imageBasename),
      };
    });

  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let batchIdx = 0;
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const outPath = path.join(OUT_DIR, `batch-${batchIdx}.json`);
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf8');
    batchIdx++;
  }

  console.log(`Wrote ${batchIdx} batches (${eligible.length} products) to ${OUT_DIR}`);
}

main();
```

- [ ] **Step 3: Add the npm script**

Edit `package.json`. Find the `"scripts"` block (lines 5-20) and add this entry after the existing `"scrape-gallery"` line, with a trailing comma added to that previous line if missing:

```json
    "audit-prep": "tsx scripts/audit-prep.ts",
```

- [ ] **Step 4: Run the script and verify the output**

Run: `npm run audit-prep`
Expected output (count may differ if data changed):

```
Wrote 15 batches (427 products) to <abs path>/scripts/audit-batches
```

Verify: `ls scripts/audit-batches/` should list `batch-0.json` through `batch-14.json` (15 files). Open `batch-0.json` and confirm it's a JSON array of objects with `id`, `name`, `categoryName`, `imagePath` keys, with `imagePath` resolvable on disk.

- [ ] **Step 5: Commit**

```
git add .gitignore scripts/audit-prep.ts package.json
git commit -m "feat(scripts): audit-prep splits products into vision batches of 30"
```

(The `scripts/audit-batches/` directory itself is gitignored, so it won't be committed.)

---

## Task 3: Phase 1 — vision audit via nested subagent dispatch

**Files:**
- Create: `scripts/audit-results.json` (output, gitignored — produced by the subagent worker dispatches)

This is the central Phase 1 task. The implementer for this task does not write code itself — it orchestrates 15 vision-worker subagents (one per batch) using the Agent tool, collects their classifications, and writes the combined result to `scripts/audit-results.json`.

**Why nested orchestration here:** vision work is fundamentally batched (each subagent reads ~30 image files into its context), and there's no way to do it from a Node script without an API key. The implementer subagent becomes a thin coordinator.

- [ ] **Step 1: Implementer reads the batch index**

The implementer subagent's first action is:

```bash
ls scripts/audit-batches/
```

Expected: 15 files `batch-0.json` through `batch-14.json`. Note the count for the loop below.

- [ ] **Step 2: For each batch, dispatch a vision worker subagent**

For `batch_idx` in `0..14` (or whatever count Step 1 produced), dispatch one Agent (general-purpose, model `sonnet`) with this exact prompt structure (substitute `{BATCH_IDX}` and `{ABS_PROJECT_ROOT}`):

```
You are classifying product image matches for the Lumière B2B catalog.

Working directory: {ABS_PROJECT_ROOT}

Open `scripts/audit-batches/batch-{BATCH_IDX}.json`. It contains a JSON array of objects:
{
  "id": <number>,
  "name": "<product name>",
  "categoryName": "<category>",
  "imagePath": "<absolute path to product image>"
}

For EACH entry in the array:
1. Use the Read tool with `file_path` = `imagePath` to view the image.
2. Decide if the image matches the product. Match strictly by visible brand wording on packaging. The category gives weak signal — trust the visible brand text first.
3. Classify as one of:
   - CONFIRMED  — image clearly shows packaging or vial that bears the named product
   - MISMATCH   — image clearly shows a different product (different brand on box, different product line)
   - UNCERTAIN  — image is generic (anonymous ampoule, stock photo, blurred), or shows partial branding you cannot verify

Return ONLY a JSON array with the same length as the input, each element shaped as:
{ "id": <number>, "status": "CONFIRMED" | "MISMATCH" | "UNCERTAIN", "reason": "<one short sentence>" }

No markdown fences, no commentary outside the JSON.
```

After each dispatch returns, append the parsed JSON array to a running buffer (write to `scripts/audit-results.json` after each batch so progress is durable).

- [ ] **Step 3: Validate the combined output**

After all 15 batches, `scripts/audit-results.json` should contain a single JSON array with 427 entries (one per product with an image). Every entry should have a valid `status` from the allowed set.

Run a quick validation in Node:

```bash
node -e "const r=require('./scripts/audit-results.json'); console.log('total:',r.length); console.log('confirmed:',r.filter(x=>x.status==='CONFIRMED').length); console.log('mismatch:',r.filter(x=>x.status==='MISMATCH').length); console.log('uncertain:',r.filter(x=>x.status==='UNCERTAIN').length); console.log('invalid:',r.filter(x=>!['CONFIRMED','MISMATCH','UNCERTAIN'].includes(x.status)).length);"
```

Expected output (counts may vary):
```
total: 427
confirmed: ~320
mismatch:  ~75
uncertain: ~32
invalid:   0
```

If `invalid` is non-zero, the worker subagent returned malformed output. Re-dispatch the offending batch(es).

- [ ] **Step 4: Commit the results file**

`scripts/audit-results.json` is gitignored, so no commit needed — it lives only locally as an intermediate. The actual mutation to `products.json` happens in Task 4.

Status reported back to the controller: DONE (with classification summary counts).

---

## Task 4: Audit-apply — mutate products.json based on audit results

**Files:**
- Create: `scripts/audit-apply.ts`
- Modify: `package.json` (add `audit-apply` npm script)
- Modify: `data/products.json` (clears bad images)
- Create: `scripts/audit-report.txt` (human-readable summary)
- Create: `data/backups/products-{ISO}.json` (auto-generated backup)

- [ ] **Step 1: Create `scripts/audit-apply.ts`**

Write to `scripts/audit-apply.ts`:

```ts
/**
 * Reads scripts/audit-results.json (produced by the Phase 1 vision-worker
 * subagents) and mutates data/products.json: any product whose status is
 * MISMATCH or UNCERTAIN has its `image` and `images` fields cleared so
 * Phase 2 can refill from a secondary source. Writes a timestamped backup
 * first and a human-readable report afterwards.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const RESULTS_FILE = path.join(process.cwd(), 'scripts', 'audit-results.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'audit-report.txt');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

type Status = 'CONFIRMED' | 'MISMATCH' | 'UNCERTAIN';
interface AuditResult { id: number; status: Status; reason: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
  images?: string[];
}
interface DataFile { categories: unknown; products: Product[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const results: AuditResult[] = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  const resultById = new Map(results.map(r => [r.id, r]));

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  let cleared = 0;
  for (const p of data.products) {
    const r = resultById.get(p.id);
    if (!r) continue;
    if (r.status === 'MISMATCH' || r.status === 'UNCERTAIN') {
      p.image = '';
      delete p.images;
      cleared++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Cleared ${cleared} mismatched/uncertain image(s) from data/products.json`);

  // Report
  const productById = new Map(data.products.map(p => [p.id, p]));
  const buckets: Record<Status, AuditResult[]> = { CONFIRMED: [], MISMATCH: [], UNCERTAIN: [] };
  for (const r of results) buckets[r.status].push(r);

  const lines: string[] = [];
  for (const status of ['MISMATCH', 'UNCERTAIN', 'CONFIRMED'] as const) {
    lines.push(`=== ${status} (${buckets[status].length}) ===`);
    for (const r of buckets[status]) {
      const p = productById.get(r.id);
      lines.push(`#${r.id}  ${p?.name ?? '???'}  →  ${r.reason}`);
    }
    lines.push('');
  }
  fs.writeFileSync(REPORT_FILE, lines.join('\n'), 'utf8');
  console.log(`Report written to ${REPORT_FILE}`);
}

main();
```

- [ ] **Step 2: Add the npm script**

Edit `package.json` `scripts` block, add after the `audit-prep` line:

```json
    "audit-apply": "tsx scripts/audit-apply.ts",
```

- [ ] **Step 3: Run audit-apply and confirm**

Run: `npm run audit-apply`

Expected output (counts vary with audit results):
```
Backup written to <abs>/data/backups/products-2026-05-16T...-...Z.json
Cleared ~107 mismatched/uncertain image(s) from data/products.json
Report written to <abs>/scripts/audit-report.txt
```

Open `scripts/audit-report.txt` and spot-check 5 entries in each section — confirm the MISMATCH reasons make sense.

- [ ] **Step 4: Verify the build still passes (with cleared images)**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages. Products with empty `image` strings will fall back to whatever the catalog UI does for empty paths (Next/Image will show a broken state, but the build itself does not fail).

- [ ] **Step 5: Commit**

```
git add scripts/audit-apply.ts package.json scripts/audit-report.txt data/products.json
git commit -m "feat(data): audit and clear mismatched product images via subagent vision"
```

(Backup file under `data/backups/` is also included if not gitignored. If gitignored, it stays local only — that's fine.)

---

## Task 5: Gofillerss sitemap parser

**Files:**
- Create: `scripts/sync-from-gofillerss.ts`
- Modify: `package.json` (add `sync-gofillerss` npm script for manual debugging — not strictly required by the pipeline but useful)

This script is the gofillerss analogue of `sync-from-aesthetics-shop.ts` but adapted for Shopify. It does NOT write to products.json on its own — it exports a function returning parsed product entries that `refill-from-secondary.ts` (Task 6) consumes.

- [ ] **Step 1: Create `scripts/sync-from-gofillerss.ts`**

Write to `scripts/sync-from-gofillerss.ts`:

```ts
/**
 * Parses the mg.gofillerss.com Shopify sitemap and returns product entries
 * with slug, name, and image URL. Used by refill-from-secondary.ts as the
 * secondary scraping source.
 */

import axios from 'axios';

const SITEMAP_INDEX = 'https://mg.gofillerss.com/sitemap.xml';
const TIMEOUT_MS = 30_000;

export interface GofillerssProduct {
  slug: string;
  name: string;
  imageUrl: string;
}

interface SitemapRef { loc: string }

async function fetchText(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  return res.data;
}

async function fetchSitemapIndex(): Promise<SitemapRef[]> {
  const xml = await fetchText(SITEMAP_INDEX);
  const refs: SitemapRef[] = [];
  const blocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) ?? [];
  for (const block of blocks) {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    if (m) refs.push({ loc: m[1] });
  }
  return refs;
}

async function fetchProductSitemap(url: string): Promise<GofillerssProduct[]> {
  const xml = await fetchText(url);
  const products: GofillerssProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(https:\/\/mg\.gofillerss\.com\/products\/([^<]+))<\/loc>/);
    if (!locMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');

    // Shopify product entries embed image:image with image:loc and image:title
    const imgLocMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/);
    const imgTitleMatch = block.match(/<image:title>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/image:title>/);
    if (!imgLocMatch) continue;

    const name = (imgTitleMatch?.[1] ?? slug.replace(/-/g, ' ')).trim();
    products.push({ slug, name, imageUrl: imgLocMatch[1] });
  }

  return products;
}

export async function fetchAllGofillerssProducts(): Promise<GofillerssProduct[]> {
  const refs = await fetchSitemapIndex();
  const productSitemaps = refs.filter(r => /sitemap_products_/i.test(r.loc));
  if (productSitemaps.length === 0) {
    throw new Error('No sitemap_products_* found in gofillerss sitemap index');
  }
  const all: GofillerssProduct[] = [];
  for (const ref of productSitemaps) {
    const batch = await fetchProductSitemap(ref.loc);
    all.push(...batch);
  }
  return all;
}

// CLI smoke test: run with `npm run sync-gofillerss` to dump the parsed list.
if (require.main === module) {
  fetchAllGofillerssProducts()
    .then(products => {
      console.log(`Parsed ${products.length} products from gofillerss.`);
      console.log('First 3:', JSON.stringify(products.slice(0, 3), null, 2));
    })
    .catch(err => {
      console.error('Failed:', err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Add the npm script**

Edit `package.json` `scripts` block, add after `audit-apply`:

```json
    "sync-gofillerss": "tsx scripts/sync-from-gofillerss.ts",
```

- [ ] **Step 3: Run the smoke test**

Run: `npm run sync-gofillerss`

Expected output (count varies — gofillerss inventory may differ):
```
Parsed <N> products from gofillerss.
First 3: [
  { "slug": "...", "name": "...", "imageUrl": "https://cdn.shopify.com/..." },
  ...
]
```

If the script fails with a parsing error, inspect the actual sitemap content (`curl https://mg.gofillerss.com/sitemap.xml` and `curl <first product sitemap URL>`) and adjust the regex in `fetchProductSitemap`. The Shopify XML format is stable but the exact `<image:title>` CDATA wrapping varies by theme.

If the script succeeds: do NOT commit yet (we'll combine with Task 6).

- [ ] **Step 4: Commit**

```
git add scripts/sync-from-gofillerss.ts package.json
git commit -m "feat(scripts): add gofillerss Shopify sitemap parser"
```

---

## Task 6: Refill-from-secondary — fuzzy match and stage candidates

**Files:**
- Create: `scripts/refill-from-secondary.ts`
- Modify: `package.json` (add `refill-secondary` npm script)
- Create: `scripts/secondary-candidates.json` (output, gitignored)
- Create: `public/images/products/product-{id}-secondary.webp` files (staging, gitignored)

This script iterates over every product that needs refilling (empty `image` OR description shorter than 50 chars), fuzzy-matches against the gofillerss sitemap, downloads the candidate image to a `-secondary` staging path, and writes everything to `secondary-candidates.json`. **No mutation to `data/products.json` yet** — that happens after vision verification in Task 8.

- [ ] **Step 1: Create `scripts/refill-from-secondary.ts`**

Write to `scripts/refill-from-secondary.ts`:

```ts
/**
 * For every Lumière product with empty image OR weak description (<50 chars),
 * fuzzy-match against gofillerss and stage a candidate. Writes:
 *   - public/images/products/product-{id}-secondary.webp  (staging images)
 *   - scripts/secondary-candidates.json                   (manifest)
 *
 * Does NOT mutate data/products.json. Phase 2's vision-verification step
 * (Task 7) decides what gets promoted.
 *
 * Also tries to fetch a description from the candidate's product page via
 * Shopify's product JSON endpoint (/products/{slug}.json).
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

import { normalise, scoreMatch } from './lib/fuzzy-match';
import { fetchAllGofillerssProducts, GofillerssProduct } from './sync-from-gofillerss';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const CANDIDATES_FILE = path.join(process.cwd(), 'scripts', 'secondary-candidates.json');
const MIN_SCORE = 2;
const MIN_DESC_LEN = 50;
const DELAY_MS = 800;

interface Product {
  id: number;
  name: string;
  image: string;
  description: string;
  images?: string[];
}
interface Candidate {
  id: number;
  productName: string;
  matchedSlug: string;
  matchedName: string;
  matchScore: number;
  stagingImagePath: string;
  candidateDescription: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function downloadAndStage(url: string, productId: number): Promise<string> {
  const stagingName = `product-${productId}-secondary.webp`;
  const stagingPath = path.join(IMAGE_DIR, stagingName);
  const res = await axios.get<ArrayBuffer>(url, {
    timeout: 30_000,
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  await sharp(Buffer.from(res.data))
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(stagingPath);
  return `/images/products/${stagingName}`;
}

async function fetchShopifyDescription(slug: string): Promise<string> {
  try {
    const res = await axios.get<{ product?: { body_html?: string } }>(
      `https://mg.gofillerss.com/products/${slug}.json`,
      { timeout: 20_000 }
    );
    const html = res.data.product?.body_html ?? '';
    // Strip tags, collapse whitespace, take first 300 chars
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

function bestMatch(product: Product, source: GofillerssProduct[]): { entry: GofillerssProduct; score: number } | null {
  const target = normalise(product.name);
  let best: { entry: GofillerssProduct; score: number } | null = null;
  for (const src of source) {
    const score = scoreMatch(target, normalise(src.name));
    if (score >= MIN_SCORE && (best === null || score > best.score)) {
      best = { entry: src, score };
    }
  }
  return best;
}

async function main(): Promise<void> {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('Fetching gofillerss sitemap…');
  const source = await fetchAllGofillerssProducts();
  console.log(`Got ${source.length} gofillerss products.`);

  const needsRefill = data.products.filter(p =>
    !p.image || p.image.length === 0 || !p.description || p.description.length < MIN_DESC_LEN
  );
  console.log(`${needsRefill.length} products need refill.`);

  const candidates: Candidate[] = [];
  let processed = 0;

  for (const p of needsRefill) {
    processed++;
    const match = bestMatch(p, source);
    if (!match) {
      console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: NO MATCH`);
      continue;
    }

    let stagingImagePath = '';
    if (!p.image || p.image.length === 0) {
      try {
        stagingImagePath = await downloadAndStage(match.entry.imageUrl, p.id);
      } catch (err) {
        console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: IMAGE DOWNLOAD FAILED — ${(err as Error).message}`);
      }
    }

    let candidateDescription = '';
    if (!p.description || p.description.length < MIN_DESC_LEN) {
      candidateDescription = await fetchShopifyDescription(match.entry.slug);
    }

    candidates.push({
      id: p.id,
      productName: p.name,
      matchedSlug: match.entry.slug,
      matchedName: match.entry.name,
      matchScore: match.score,
      stagingImagePath,
      candidateDescription,
    });

    console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: matched "${match.entry.slug}" (score ${match.score})${stagingImagePath ? ' + img' : ''}${candidateDescription ? ' + desc' : ''}`);
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2), 'utf8');
  console.log(`Wrote ${candidates.length} candidates to ${CANDIDATES_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

Edit `package.json`, add after `sync-gofillerss`:

```json
    "refill-secondary": "tsx scripts/refill-from-secondary.ts",
```

- [ ] **Step 3: Run the refill script**

Run: `npm run refill-secondary`

Expected output:
```
Fetching gofillerss sitemap…
Got <N> gofillerss products.
~<M> products need refill.
[1/<M>] #14 ELASTY FINE PLUS: matched "elasty-fine-plus" (score 4) + img + desc
[2/<M>] #17 VOM LIGHT (CE) NO Lidocaine: NO MATCH
…
Wrote <K> candidates to <abs>/scripts/secondary-candidates.json
```

Expect this script to take 5-15 minutes (due to per-product 800ms delay against gofillerss to be polite). The output is durable in `secondary-candidates.json`; if the script is interrupted, you can re-run — it's idempotent because staging files are recreated and the candidates manifest is rewritten.

Verify:
```bash
node -e "const c=require('./scripts/secondary-candidates.json'); console.log('candidates:',c.length); console.log('with image:',c.filter(x=>x.stagingImagePath).length); console.log('with desc:',c.filter(x=>x.candidateDescription).length);"
```

- [ ] **Step 4: Commit the script**

The output files (`secondary-candidates.json`, staging webps) are gitignored. Only the script and package.json change should be committed.

```
git add scripts/refill-from-secondary.ts package.json
git commit -m "feat(scripts): stage secondary-source candidates from gofillerss"
```

---

## Task 7: Vision-verify the secondary candidates

**Files:**
- Modify: `scripts/secondary-candidates.json` (each candidate gets a `verifyStatus` field appended)

Same nested-subagent pattern as Task 3. The implementer for this task dispatches vision-worker subagents on the staged secondary images and labels each candidate CONFIRMED/MISMATCH/UNCERTAIN. The result is written back into `secondary-candidates.json` (in place — gitignored, so safe to mutate).

- [ ] **Step 1: Implementer reads the candidates manifest**

```bash
node -e "const c=require('./scripts/secondary-candidates.json'); console.log('total:',c.length,'with_image:',c.filter(x=>x.stagingImagePath).length);"
```

Note the count of candidates with `stagingImagePath` set (only those need vision verification — entries with only a `candidateDescription` skip vision).

- [ ] **Step 2: Slice into batches of 30 and dispatch vision workers**

For candidates with `stagingImagePath`, split into batches of 30. For each batch, dispatch an Agent (general-purpose, sonnet) with this prompt structure (substitute `{BATCH_INDEX}`, `{ABS_PROJECT_ROOT}`, and inline the batch's JSON entries):

```
You are verifying secondary-source product image candidates for the Lumière catalog.

Working directory: {ABS_PROJECT_ROOT}

Below is a JSON array of {count} candidate entries. For each one:
1. Use the Read tool with file_path = {ABS_PROJECT_ROOT}/public + stagingImagePath (e.g. {ABS_PROJECT_ROOT}/public/images/products/product-14-secondary.webp).
2. Decide whether the image matches `productName`. Match strictly by visible brand wording on packaging.
3. Classify as CONFIRMED | MISMATCH | UNCERTAIN.

Return ONLY a JSON array with the SAME LENGTH and ORDER as the input, each element:
{ "id": <number>, "verifyStatus": "CONFIRMED"|"MISMATCH"|"UNCERTAIN", "verifyReason": "<one short sentence>" }

No markdown fences, no commentary.

Input:
{INLINE_BATCH_JSON}
```

After each dispatch returns, merge `verifyStatus` and `verifyReason` into the matching entries of `scripts/secondary-candidates.json` by `id`.

- [ ] **Step 3: Validate**

Run:
```bash
node -e "const c=require('./scripts/secondary-candidates.json'); const withImg=c.filter(x=>x.stagingImagePath); console.log('with image:',withImg.length); console.log('verified:',withImg.filter(x=>x.verifyStatus).length); console.log('confirmed:',withImg.filter(x=>x.verifyStatus==='CONFIRMED').length); console.log('mismatch:',withImg.filter(x=>x.verifyStatus==='MISMATCH').length); console.log('uncertain:',withImg.filter(x=>x.verifyStatus==='UNCERTAIN').length);"
```

All `withImg` entries should have a `verifyStatus`. If any are missing, re-dispatch the missing batches.

Status reported back to controller: DONE (with counts).

(No commit — `secondary-candidates.json` is gitignored.)

---

## Task 8: Refill-apply — promote verified candidates and generate missingproducts.txt

**Files:**
- Create: `scripts/refill-apply.ts`
- Modify: `package.json` (add `refill-apply` npm script)
- Modify: `data/products.json` (fills CONFIRMED image paths and descriptions)
- Create: `public/missingproducts.txt`
- Create: `scripts/refill-report.txt`
- Create: `data/backups/products-{ISO}.json` (auto-generated)

- [ ] **Step 1: Create `scripts/refill-apply.ts`**

Write to `scripts/refill-apply.ts`:

```ts
/**
 * Reads scripts/secondary-candidates.json (with verifyStatus from Task 7)
 * and applies the verified results:
 *   - CONFIRMED images: rename product-{id}-secondary.webp to product-{id}.webp,
 *     set products.json[id].image = "/images/products/product-{id}.webp"
 *   - MISMATCH or UNCERTAIN images: delete the staging file, leave image empty
 *   - Descriptions (any candidate with non-empty candidateDescription, regardless
 *     of verifyStatus): persist into products.json[id].description if currently
 *     short. Descriptions are text-only — no vision verification needed.
 *
 * Also emits scripts/refill-report.txt and public/missingproducts.txt.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const CANDIDATES_FILE = path.join(process.cwd(), 'scripts', 'secondary-candidates.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'refill-report.txt');
const MISSING_FILE = path.join(process.cwd(), 'public', 'missingproducts.txt');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MIN_DESC_LEN = 50;

type VerifyStatus = 'CONFIRMED' | 'MISMATCH' | 'UNCERTAIN';
interface Candidate {
  id: number;
  productName: string;
  matchedSlug: string;
  matchedName: string;
  matchScore: number;
  stagingImagePath: string;
  candidateDescription: string;
  verifyStatus?: VerifyStatus;
  verifyReason?: string;
}
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
  description: string;
}
interface Category { id: string; name: string }
interface DataFile { categories: Category[]; products: Product[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const candidates: Candidate[] = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
  const candById = new Map(candidates.map(c => [c.id, c]));
  const productById = new Map(data.products.map(p => [p.id, p]));
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  backupDataFile();

  let imagesFilled = 0, imagesRejected = 0, descsFilled = 0;
  const promoted: number[] = [];
  const rejected: number[] = [];

  for (const c of candidates) {
    const p = productById.get(c.id);
    if (!p) continue;

    // Image side
    if (c.stagingImagePath && c.verifyStatus === 'CONFIRMED') {
      const stagingBase = path.basename(c.stagingImagePath);
      const finalBase = stagingBase.replace('-secondary.webp', '.webp');
      const stagingAbs = path.join(IMAGE_DIR, stagingBase);
      const finalAbs = path.join(IMAGE_DIR, finalBase);
      if (fs.existsSync(stagingAbs)) {
        fs.renameSync(stagingAbs, finalAbs);
        p.image = `/images/products/${finalBase}`;
        imagesFilled++;
        promoted.push(c.id);
      }
    } else if (c.stagingImagePath && (c.verifyStatus === 'MISMATCH' || c.verifyStatus === 'UNCERTAIN')) {
      const stagingBase = path.basename(c.stagingImagePath);
      const stagingAbs = path.join(IMAGE_DIR, stagingBase);
      if (fs.existsSync(stagingAbs)) fs.unlinkSync(stagingAbs);
      imagesRejected++;
      rejected.push(c.id);
    }

    // Description side (no vision needed — text comes from matched product page)
    if (c.candidateDescription && c.candidateDescription.length >= MIN_DESC_LEN &&
        (!p.description || p.description.length < MIN_DESC_LEN)) {
      p.description = c.candidateDescription;
      descsFilled++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Filled ${imagesFilled} image(s), rejected ${imagesRejected}, filled ${descsFilled} description(s).`);

  // Refill report
  const reportLines: string[] = [];
  reportLines.push(`=== PROMOTED IMAGES (${promoted.length}) ===`);
  for (const id of promoted) {
    const c = candById.get(id)!;
    reportLines.push(`#${id}  ${c.productName}  ←  ${c.matchedSlug}`);
  }
  reportLines.push('');
  reportLines.push(`=== REJECTED CANDIDATES (${rejected.length}) ===`);
  for (const id of rejected) {
    const c = candById.get(id)!;
    reportLines.push(`#${id}  ${c.productName}  ←  ${c.matchedSlug}  reason: ${c.verifyReason ?? '?'}`);
  }
  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');

  // missingproducts.txt: every product still missing image or description
  const missing = data.products.filter(p =>
    !p.image || p.image.length === 0 || !p.description || p.description.length < MIN_DESC_LEN
  );

  const lines: string[] = [];
  lines.push('# missingproducts.txt');
  lines.push(`# Last generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('# Products that could not be enriched from aesthetics-shop.com or mg.gofillerss.com.');
  lines.push('# Manually source images and/or descriptions for these and add them via the admin UI.');
  lines.push('');
  lines.push('ID   | Name                                    | Category              | Missing');
  lines.push('---- | --------------------------------------- | --------------------- | -----------------');
  for (const p of missing) {
    const missingFields: string[] = [];
    if (/^Product \d+$/.test(p.name)) missingFields.push('name');
    if (!p.image || p.image.length === 0) missingFields.push('image');
    if (!p.description || p.description.length < MIN_DESC_LEN) missingFields.push('description');
    lines.push(
      `${String(p.id).padEnd(4)} | ${p.name.padEnd(39)} | ${(catName.get(p.categoryId) ?? p.categoryId).padEnd(21)} | ${missingFields.join(', ')}`
    );
  }
  fs.writeFileSync(MISSING_FILE, lines.join('\n'), 'utf8');
  console.log(`Wrote ${missing.length} entries to ${MISSING_FILE}`);
}

main();
```

- [ ] **Step 2: Add the npm script**

Edit `package.json`, add after `refill-secondary`:

```json
    "refill-apply": "tsx scripts/refill-apply.ts",
```

- [ ] **Step 3: Run refill-apply**

Run: `npm run refill-apply`
Expected:
```
Filled <X> image(s), rejected <Y>, filled <Z> description(s).
Wrote <N> entries to <abs>/public/missingproducts.txt
```

Verify outputs exist:
- `public/missingproducts.txt` — readable table
- `scripts/refill-report.txt` — promoted vs rejected
- `data/products.json` — updated with new image paths and descriptions
- No remaining `product-*-secondary.webp` files in `public/images/products/` (all promoted or deleted)

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages.

- [ ] **Step 5: Commit**

```
git add scripts/refill-apply.ts package.json scripts/refill-report.txt public/missingproducts.txt data/products.json
git commit -m "feat(data): refill missing images/descriptions from gofillerss, gen missingproducts.txt"
```

---

## Task 9: Derive groupName + groupImage

**Files:**
- Create: `scripts/derive-group-display.ts`
- Modify: `package.json` (add `derive-groups` npm script)
- Modify: `data/products.json` (adds groupName and groupImage to grouped products)
- Modify: `lib/products.ts` (extend the `Product` interface)

- [ ] **Step 1: Extend the Product interface**

Open `lib/products.ts`. Find the `Product` interface (around lines 17-35). Add two optional fields after `images?: string[];`:

```ts
  groupName?: string;
  groupImage?: string;
```

The interface should now end:
```ts
  enrichedInfo?: EnrichedInfo;
  groupId?: string;
  variantLabel?: string;
  images?: string[];
  groupName?: string;
  groupImage?: string;
}
```

- [ ] **Step 2: Create `scripts/derive-group-display.ts`**

Write to `scripts/derive-group-display.ts`:

```ts
/**
 * For each groupId in products.json, derive a clean group display name and
 * pick a group image. Writes groupName + groupImage back onto every product
 * in the group. Run after Phase 2 (so cleared/refilled images are settled).
 *
 * Algorithm:
 *   groupName  = longest leading uppercase token shared by every variant
 *                in the group, title-cased. Fallback: groupId title-cased.
 *   groupImage = first existing image among variants (Phase 2 may have
 *                produced a dedicated bundle photo at /images/products/
 *                group-{groupId}.webp; if so, use that instead).
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  groupName?: string;
  groupImage?: string;
}
interface DataFile { products: Product[] }

function backupDataFile(): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `products-${stamp}.json`));
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, ch => ch.toUpperCase());
}

/** Take the longest leading-aligned uppercase token shared by all names. */
function deriveGroupName(names: string[], fallback: string): string {
  const tokenLists = names.map(n =>
    n.trim().split(/\s+/).filter(t => /^[A-Z][A-Z0-9-]*$/.test(t))
  );
  if (tokenLists.length === 0 || tokenLists.some(l => l.length === 0)) {
    return titleCase(fallback.replace(/-/g, ' '));
  }
  // Find shared leading tokens
  const shared: string[] = [];
  const maxLen = Math.min(...tokenLists.map(l => l.length));
  for (let i = 0; i < maxLen; i++) {
    const tok = tokenLists[0][i];
    if (tokenLists.every(l => l[i] === tok)) shared.push(tok);
    else break;
  }
  if (shared.length === 0) return titleCase(fallback.replace(/-/g, ' '));
  return titleCase(shared.join(' '));
}

function main(): void {
  const data: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  backupDataFile();

  const groups = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  let touched = 0;
  for (const [groupId, members] of groups) {
    const names = members.map(m => m.name);
    const groupName = deriveGroupName(names, groupId);

    // Prefer a dedicated bundle image if one was captured
    const dedicated = `/images/products/group-${groupId}.webp`;
    const dedicatedAbs = path.join(IMAGE_DIR, `group-${groupId}.webp`);
    let groupImage = '';
    if (fs.existsSync(dedicatedAbs)) {
      groupImage = dedicated;
    } else {
      const firstWithImage = members.find(m => m.image && m.image.length > 0);
      groupImage = firstWithImage?.image ?? '';
    }

    for (const m of members) {
      m.groupName = groupName;
      m.groupImage = groupImage;
      touched++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Set groupName/groupImage on ${touched} product(s) across ${groups.size} group(s).`);
}

main();
```

- [ ] **Step 3: Add the npm script**

Edit `package.json`, add after `refill-apply`:

```json
    "derive-groups": "tsx scripts/derive-group-display.ts",
```

- [ ] **Step 4: Run the script**

Run: `npm run derive-groups`
Expected:
```
Set groupName/groupImage on 89 product(s) across 33 group(s).
```

Spot-check the result:
```bash
node -e "const d=require('./data/products.json'); const g=d.products.filter(p=>p.groupId).reduce((a,p)=>{a[p.groupId]=p.groupName;return a;},{}); console.log(g);"
```

Expected output (showing some examples):
```
{
  'barbie-slim': 'Barbie Slim',
  'regenovue-sub-q': 'Regenovue',
  'sosum': 'Sosum',
  'neuramis': 'Neuramis',
  ...
}
```

If any group still shows the raw `groupId` (e.g. `Regenovue-Sub-Q`), the algorithm fell back — check that group's variant names manually and decide if the fallback is acceptable or if a name override is needed (in this plan we accept fallbacks).

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages.

- [ ] **Step 6: Commit**

```
git add lib/products.ts scripts/derive-group-display.ts package.json data/products.json
git commit -m "feat(data): derive groupName and groupImage for the 33 product groups"
```

---

## Task 10: Use groupName / groupImage in ProductCard

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`

The catalogue currently deduplicates grouped products on the grid but renders the first variant's name and image on the deduplicated card. After this change, the deduplicated card uses `groupName` and `groupImage` instead, giving a "this is a bundle of variants" feel.

**Context already verified by plan writer:** The signal that a card represents a group is `variantCount > 1` (passed in as a prop by `CatalogueClient`). This is the same condition that gates the "N options" pill render at line 64-68 (list layout) and 136-140 (grid layout). The card has two layouts: 'list' (lines 37-92) and 'grid' (lines 94-156). Both need the same treatment for title + image, but `handleAddToCart` must stay unchanged (the underlying click adds the first variant to the cart, so the cart item should remain the variant, not the group label).

- [ ] **Step 1: Add the display variables at the top of the component**

Open `components/catalogue/ProductCard.tsx`. After the existing destructured `{ currency }` line in the body (around line 23), add two computed display values that both layouts share:

```tsx
  const isGroup = variantCount > 1;
  const displayName = isGroup && product.groupName ? product.groupName : product.name;
  const displayImage = isGroup && product.groupImage ? product.groupImage : product.image;
```

The body of the component should now look like (showing context):

```tsx
export default function ProductCard({ product, layout = 'grid', variantCount = 1 }: ProductCardProps) {
  const t = useTranslations('catalogue');
  const tProduct = useTranslations('product');
  const locale = useLocale();
  const { addItem } = useCartStore();
  const { currency } = useCurrencyStore();

  const isGroup = variantCount > 1;
  const displayName = isGroup && product.groupName ? product.groupName : product.name;
  const displayImage = isGroup && product.groupImage ? product.groupImage : product.image;

  function handleAddToCart(e: React.MouseEvent) {
    // unchanged — cart still tracks the underlying variant
```

- [ ] **Step 2: Update the LIST layout's image + title to use the display values**

In the 'list' layout block (around lines 37-92), make these replacements:

Replace (around line 44-51):
```tsx
          <ProductImage
            src={product.image}
            alt={product.name}
            productId={product.id}
            categoryId={product.categoryId}
            fill
            sizes="80px"
          />
```
With:
```tsx
          <ProductImage
            src={displayImage}
            alt={displayName}
            productId={product.id}
            categoryId={product.categoryId}
            fill
            sizes="80px"
          />
```

Replace (around line 61-63):
```tsx
              <h3 className="text-sm font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight">
                #{product.id} {product.name}
              </h3>
```
With:
```tsx
              <h3 className="text-sm font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight">
                #{product.id} {displayName}
              </h3>
```

Leave `handleAddToCart` and everything else in the list layout unchanged.

- [ ] **Step 3: Update the GRID layout's image + title to use the display values**

In the default ('grid') layout block (around lines 94-156), make these replacements:

Replace (around line 101-109):
```tsx
        <ProductImage
          src={product.image}
          alt={product.name}
          productId={product.id}
          categoryId={product.categoryId}
          fill
          className="group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
```
With:
```tsx
        <ProductImage
          src={displayImage}
          alt={displayName}
          productId={product.id}
          categoryId={product.categoryId}
          fill
          className="group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
```

Replace (around line 133-135):
```tsx
        <h3 className="text-xs font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-1">
          {product.name}
        </h3>
```
With:
```tsx
        <h3 className="text-xs font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-1">
          {displayName}
        </h3>
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages.

- [ ] **Step 5: Manual visual check**

Start dev server if not already running: `npm run dev`. Open `http://localhost:3000/en/catalogue/fillers`.

Verify:
- The Regenovue card now shows **Regenovue** (not REGENOVUE FINE PLUS (CE)).
- The Sosum card shows **Sosum**.
- The Neuramis card shows **Neuramis**.
- All three still show the "N options available" pill with their variant counts.
- Click any group card → land on the first-variant product detail page. That page shows the variant name (e.g. REGENOVUE FINE PLUS (CE)) and variant image, unchanged.
- Non-grouped products (e.g. BARBIE SLIM) still show their normal name + image (no change).
- Switch to list view (the `<List>` icon in the catalogue toolbar) and confirm the same group cards display group names there too.

- [ ] **Step 6: Commit**

```
git add components/catalogue/ProductCard.tsx
git commit -m "feat(ui): use groupName and groupImage on deduplicated catalog cards"
```

---

## Task 11: Final end-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: `Compiled successfully`, all 38 pages prerender.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: problem count at or below the pre-Spec-2 baseline (69 problems). No new errors introduced by this work.

- [ ] **Step 3: Audit-report spot-check**

Open `scripts/audit-report.txt`. Verify:
- MISMATCH section exists with concrete reasons (not generic "image doesn't match").
- CONFIRMED section is the largest by count.
- Total entries = total products with images at audit time (~427).

- [ ] **Step 4: Refill-report spot-check**

Open `scripts/refill-report.txt`. Verify:
- PROMOTED IMAGES section lists candidate filenames that match real products.
- REJECTED CANDIDATES section, if non-empty, has reasons.

- [ ] **Step 5: missingproducts.txt review**

Open `public/missingproducts.txt`. Verify:
- Tabular format renders cleanly in a plain text viewer.
- Every entry has a non-empty `Missing` column.
- Products with placeholder names (e.g. "Product 70") are marked as missing `name`.

- [ ] **Step 6: Manual UI walkthrough on dev server**

If dev server isn't running: `npm run dev`. On `http://localhost:3000`:

1. `/en/catalogue` — landing grid loads cleanly, no broken-image placeholders for grouped cards.
2. `/en/catalogue/fillers` — Regenovue / Sosum / Neuramis cards show group names + bundle images + "N options" pill.
3. Click into a Regenovue variant — variant page shows its real variant name (`REGENOVUE FINE PLUS (CE)` or similar) and variant image. VariantSelector lists all variants in the group.
4. Browse a few categories — no obviously wrong product images (the audit should have cleared the score-2 false positives).
5. `/en/product/14` (formerly ELASTY FINE PLUS with a wrong image): either has a confirmed-correct image now, or shows empty image (acceptable — it's listed in `missingproducts.txt`).
6. Back button at top of product page still works (Spec 1 behavior intact).

- [ ] **Step 7: Final git log inspection**

Run: `git log --oneline f9b7a98..HEAD`

Expected: roughly 9-10 commits, one per task, matching the commit messages above. All on `main`.

This task does not produce its own commit — it's a verification gate. If any check fails, return to the relevant prior task.

---

## Done criteria

- [ ] All 11 tasks complete.
- [ ] Build and lint clean.
- [ ] `scripts/audit-report.txt`, `scripts/refill-report.txt`, `public/missingproducts.txt` all exist and read cleanly.
- [ ] Manual UI walk-through passes.
- [ ] `data/products.json` no longer carries known false-positive images for the products listed in pre-Spec-2 mismatch reports (ELASTY FINE PLUS, VOM LIGHT, NEURAMIS VOLUME LIDOCAINE, etc.).
- [ ] All 33 product groups display a clean group name on deduplicated catalog cards.
