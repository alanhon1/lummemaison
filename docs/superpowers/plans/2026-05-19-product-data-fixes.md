# Product Data Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair broken product names/specs/descriptions in `data/products.json`, remove 16 stale products, wire `missing finds/` images, disable Russian auto-detection, and persist catalogue search/filter state across product-detail navigation.

**Architecture:** A single repair script (`scripts/repair-products.ts`) does all the data work in a backup-first, idempotent way — name-similarity matching first, ordinal fallback for `Product NNN` placeholders, with a validation pass that aborts on integrity failures. Three small UI/middleware edits handle locale and search-state retention.

**Tech Stack:** Next.js 16 (App Router), next-intl 4, TypeScript, tsx for script execution. No test framework present — verification is via script-side validation reports and manual browser checks.

**Spec:** `docs/superpowers/specs/2026-05-19-product-data-fixes-design.md`

---

## File Structure

**New files:**
- `scripts/repair-products.ts` — orchestrator (one entry point, calls helpers below)
- `scripts/lib/parse-products-txt.ts` — `products.txt` parser, pure
- `scripts/lib/match-products.ts` — name-similarity + ordinal matching, pure
- `scripts/lib/repair-report.ts` — formats the report text/JSON, pure
- `scripts/repair-products-report.txt` — generated each run (gitignored or committed; see Task 7)

**Modified files:**
- `package.json` — add `"repair-products": "tsx scripts/repair-products.ts"` script
- `proxy.ts` — add `localeDetection: false`
- `components/catalogue/CatalogueClient.tsx` — URL-driven filter state
- `components/catalogue/BackToCatalogueButton.tsx` — preserve referrer search string
- `data/products.json` — rewritten by the script
- `public/images/products/product-{id}.{ext}` — copies from `missing finds/`

**Read-only inputs:**
- `products.txt` — source of truth for names/specs
- `missing finds/` — user-supplied images

---

## Task 1: Set up package script + report scaffold

**Files:**
- Modify: `package.json`
- Create: `scripts/repair-products.ts`

- [ ] **Step 1: Add npm script**

Edit `package.json`. Insert `"repair-products": "tsx scripts/repair-products.ts",` right after the `"inventory-quality"` line so the scripts block stays alphabetically loose but coherent with the surrounding repair-oriented entries.

- [ ] **Step 2: Create the entry-point skeleton**

Create `scripts/repair-products.ts` with:

```ts
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const PRODUCTS_TXT = path.join(ROOT, 'products.txt');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'repair-products-report.txt');

function main(): void {
  console.log('repair-products: starting');
  // populated by later tasks
}

main();
```

- [ ] **Step 3: Smoke-run**

Run: `npx tsx scripts/repair-products.ts`

Expected output: `repair-products: starting`. No errors.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/repair-products.ts
git commit -m "chore(scripts): scaffold repair-products entry point"
```

---

## Task 2: products.txt parser

**Files:**
- Create: `scripts/lib/parse-products-txt.ts`

- [ ] **Step 1: Write the parser**

Create `scripts/lib/parse-products-txt.ts`:

```ts
import fs from 'node:fs';

export interface TxtEntry {
  categoryId: string;     // e.g. "fillers"
  name: string;           // before " — "
  spec: string;           // after " — " (may be empty)
  rawLine: string;        // for debugging
  lineNumber: number;     // 1-based
}

// Maps the `(N) DISPLAY NAME (#X-Y)` header text to the products.json categoryId.
// Keep this in sync with data/products.json `categories[].id`.
const CATEGORY_NAME_TO_ID: ReadonlyArray<{ matcher: RegExp; id: string }> = [
  { matcher: /^FILLERS\b/i,                                        id: 'fillers' },
  { matcher: /^MESOTHERAPY\b/i,                                    id: 'mesotherapy' },
  { matcher: /^ACNE\b/i,                                           id: 'acne-treatment' },
  { matcher: /^HAIR\b/i,                                           id: 'hair-treatment' },
  { matcher: /^PHARMACY\b/i,                                       id: 'pharmacy-favourites' },
  { matcher: /^TOPICAL\b/i,                                        id: 'topical-cosmetics' },
  { matcher: /^INTIMATE\b/i,                                       id: 'intimate-care' },
  { matcher: /^GROWTH\b/i,                                         id: 'growth-factor-exosome' },
  { matcher: /^CURENEX\b/i,                                        id: 'curenex' },
  { matcher: /^DERMAGEN\b/i,                                       id: 'dermagen' },
  { matcher: /^GTM\b/i,                                            id: 'gtm' },
  { matcher: /^EQUIPMENT\b/i,                                      id: 'equipment' },
  { matcher: /^SALON\b/i,                                          id: 'salon-grade' },
  { matcher: /^LIPOLYTIC/i,                                        id: 'lipolytics' },
  { matcher: /^BOTULINUM\b/i,                                      id: 'botulinum' },
  { matcher: /^INJECTIONS?\b/i,                                    id: 'injections' },
  { matcher: /^ANESTHETIC/i,                                       id: 'anesthetics' },
  { matcher: /^PLACENTAL\b/i,                                      id: 'placental-therapy' },
  { matcher: /^NANO\b/i,                                           id: 'nano-needle-cannula' },
  { matcher: /^IMPORTED\b/i,                                       id: 'imported-products' },
];

const HEADER_RE = /^\(\d+\)\s+(.+?)\s*\(#\d+-\d+\)\s*$/;
const DASH_RE = /\s+[—-]\s+/;

export function parseProductsTxt(file: string): TxtEntry[] {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/);
  const out: TxtEntry[] = [];
  let currentCategoryId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const headerMatch = HEADER_RE.exec(line);
    if (headerMatch) {
      const displayName = headerMatch[1].trim();
      const found = CATEGORY_NAME_TO_ID.find(c => c.matcher.test(displayName));
      currentCategoryId = found ? found.id : null;
      continue;
    }

    if (!currentCategoryId) continue;

    // An entry must have a recognised separator (em dash or hyphen surrounded by spaces).
    const parts = line.split(DASH_RE);
    if (parts.length < 2) {
      // No separator: still a product, just no spec. Common for short notes lines.
      out.push({
        categoryId: currentCategoryId,
        name: line,
        spec: '',
        rawLine: line,
        lineNumber: i + 1,
      });
      continue;
    }
    const name = parts[0].trim();
    const spec = parts.slice(1).join(' — ').trim();
    out.push({
      categoryId: currentCategoryId,
      name,
      spec,
      rawLine: line,
      lineNumber: i + 1,
    });
  }
  return out;
}
```

- [ ] **Step 2: Wire a parse-only dry run**

Append to `scripts/repair-products.ts`'s `main()` body (replace the placeholder comment):

```ts
import { parseProductsTxt } from './lib/parse-products-txt';
// ... existing imports above

const txt = parseProductsTxt(PRODUCTS_TXT);
console.log(`repair-products: parsed ${txt.length} entries from products.txt`);
const byCat = new Map<string, number>();
for (const e of txt) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + 1);
for (const [cat, n] of byCat) console.log(`  ${cat}: ${n}`);
```

- [ ] **Step 3: Run and sanity-check counts**

Run: `npx tsx scripts/repair-products.ts`

Expected: prints ~440-480 total, with per-category counts roughly matching the ranges in `data/products.json` (fillers ~70, mesotherapy ~70, equipment ~20, botulinum ~28, injections ~49, anesthetics ~14, nano-needle-cannula ~20, etc.). Exact numbers will be visible — verify that **every one of the 20 categories** in `categories` shows up at least once.

If a category is missing from the output, the `CATEGORY_NAME_TO_ID` table is wrong; fix the matcher.

- [ ] **Step 4: Commit**

```bash
git add scripts/repair-products.ts scripts/lib/parse-products-txt.ts
git commit -m "feat(scripts): products.txt parser for repair pipeline"
```

---

## Task 3: Name-similarity + ordinal matching

**Files:**
- Create: `scripts/lib/match-products.ts`

- [ ] **Step 1: Define types and the broken-name detector**

Create `scripts/lib/match-products.ts`:

```ts
import type { TxtEntry } from './parse-products-txt';

export interface JsonProduct {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  [k: string]: unknown;
}

export interface MatchResult {
  matches: Array<{ product: JsonProduct; entry: TxtEntry; reason: 'similarity' | 'ordinal' }>;
  unmatchedProducts: JsonProduct[];
  unmatchedEntries: TxtEntry[];
  perCategoryReport: Array<{ categoryId: string; productCount: number; entryCount: number; matched: number }>;
}

const BROKEN_PATTERNS: RegExp[] = [
  /^Product \d+$/,        // pure placeholder
  /^[A-Z]\.?$/,           // single capital, e.g. "C"
  /^[A-Za-z]{1,3}$/,      // 1-3 char fragments e.g. "Fere", "JBP"
];

export function isBrokenName(name: string): boolean {
  return BROKEN_PATTERNS.some(re => re.test(name.trim()));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')     // drop parenthesised qualifiers
    .replace(/[^a-z0-9]+/g, ' ')   // collapse non-alphanum
    .replace(/\b(plus|ce|lidocaine|with|no)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function prefixOverlap(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const limit = Math.min(na.length, nb.length);
  let i = 0;
  while (i < limit && na[i] === nb[i]) i++;
  return i;
}
```

- [ ] **Step 2: Implement the matcher**

Append to the same file:

```ts
export function matchByCategoryThenOrdinal(
  products: JsonProduct[],
  entries: TxtEntry[],
): MatchResult {
  const matches: MatchResult['matches'] = [];
  const perCategoryReport: MatchResult['perCategoryReport'] = [];
  const unmatchedProducts: JsonProduct[] = [];
  const unmatchedEntries: TxtEntry[] = [];

  const categoryIds = new Set<string>([...products.map(p => p.categoryId), ...entries.map(e => e.categoryId)]);

  for (const categoryId of categoryIds) {
    const catProducts = products.filter(p => p.categoryId === categoryId);
    const catEntries = entries.filter(e => e.categoryId === categoryId);

    const productClaimed = new Set<number>();   // by id
    const entryClaimed = new Set<number>();     // by index in catEntries

    // Pass 1 — similarity, only for products with non-broken names.
    for (const p of catProducts) {
      if (isBrokenName(p.name)) continue;
      let bestIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < catEntries.length; i++) {
        if (entryClaimed.has(i)) continue;
        const score = prefixOverlap(p.name, catEntries[i].name);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx >= 0 && bestScore >= 6) {
        matches.push({ product: p, entry: catEntries[bestIdx], reason: 'similarity' });
        productClaimed.add(p.id);
        entryClaimed.add(bestIdx);
      }
    }

    // Pass 2 — ordinal pairing for leftover broken + placeholders.
    const remainingProducts = catProducts.filter(p => !productClaimed.has(p.id));
    const remainingEntries = catEntries.map((e, i) => ({ e, i })).filter(x => !entryClaimed.has(x.i));
    const pairCount = Math.min(remainingProducts.length, remainingEntries.length);
    for (let k = 0; k < pairCount; k++) {
      matches.push({
        product: remainingProducts[k],
        entry: remainingEntries[k].e,
        reason: 'ordinal',
      });
      productClaimed.add(remainingProducts[k].id);
      entryClaimed.add(remainingEntries[k].i);
    }

    for (const p of catProducts) if (!productClaimed.has(p.id)) unmatchedProducts.push(p);
    catEntries.forEach((e, i) => { if (!entryClaimed.has(i)) unmatchedEntries.push(e); });

    perCategoryReport.push({
      categoryId,
      productCount: catProducts.length,
      entryCount: catEntries.length,
      matched: matches.filter(m => m.product.categoryId === categoryId).length,
    });
  }

  return { matches, unmatchedProducts, unmatchedEntries, perCategoryReport };
}
```

- [ ] **Step 3: Hook it into the dry-run**

Replace the parse-only block in `scripts/repair-products.ts` `main()` with:

```ts
import { parseProductsTxt } from './lib/parse-products-txt';
import { matchByCategoryThenOrdinal, type JsonProduct } from './lib/match-products';
// ... existing imports

const txt = parseProductsTxt(PRODUCTS_TXT);
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as { products: JsonProduct[]; categories: unknown[] };
const result = matchByCategoryThenOrdinal(data.products, txt);

console.log(`repair-products: ${result.matches.length} matches`);
console.log(`  unmatched products: ${result.unmatchedProducts.length}`);
console.log(`  unmatched entries:  ${result.unmatchedEntries.length}`);
for (const row of result.perCategoryReport) {
  console.log(`  ${row.categoryId.padEnd(28)} prods=${row.productCount} txt=${row.entryCount} matched=${row.matched}`);
}
```

- [ ] **Step 4: Run and inspect**

Run: `npx tsx scripts/repair-products.ts`

Expected: every category line shows `matched` = `productCount` (or off by a small number ≤ 2). If any category is severely off (e.g. matched=5 vs productCount=70), the parser missed a header or the category-id table is wrong; fix the offending row in `CATEGORY_NAME_TO_ID` and re-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/match-products.ts scripts/repair-products.ts
git commit -m "feat(scripts): two-pass name-similarity + ordinal matching"
```

---

## Task 4: Backup + deletion list

**Files:**
- Modify: `scripts/repair-products.ts`

- [ ] **Step 1: Implement backup helper**

Add to `scripts/repair-products.ts` (above `main`):

```ts
function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}
```

- [ ] **Step 2: Define deletion targets**

Add (above `main`):

```ts
// Deletions resolved by name + categoryId so off-by-one ID drift in earlier
// runs doesn't corrupt the list. Each entry must uniquely identify ONE product.
const DELETIONS: ReadonlyArray<{ namePattern: RegExp; categoryId: string; label: string }> = [
  // TESORO from fillers (all 7 — keep TESORO COLLAGEN in mesotherapy)
  { namePattern: /^TESORO\s+FINE\s+PLUS$/i,            categoryId: 'fillers',     label: 'TESORO FINE PLUS' },
  { namePattern: /^TESORO\s+DEEP\s+PLUS$/i,            categoryId: 'fillers',     label: 'TESORO DEEP PLUS' },
  { namePattern: /^TESORO\s+SUB\s*-?\s*Q\s+PLUS$/i,    categoryId: 'fillers',     label: 'TESORO SUB-Q PLUS' },
  { namePattern: /^TESORO\s+IMPLANT\s+WITH\s+LIDOCAINE$/i, categoryId: 'fillers', label: 'TESORO IMPLANT WITH LIDOCAINE' },
  { namePattern: /^TESORO\s+FINE$/i,                   categoryId: 'fillers',     label: 'TESORO FINE' },
  { namePattern: /^TESORO\s+DEEP$/i,                   categoryId: 'fillers',     label: 'TESORO DEEP' },
  { namePattern: /^TESORO\s+SUB\s*-?\s*Q$/i,           categoryId: 'fillers',     label: 'TESORO SUB-Q' },
  // HANHEAL from mesotherapy
  { namePattern: /^HANHEAL\s+HA\s+AMPOULE$/i,          categoryId: 'mesotherapy', label: 'HANHEAL HA AMPOULE' },
  { namePattern: /^HANHEAL\s+PDRN\s+BOOSTER$/i,        categoryId: 'mesotherapy', label: 'HANHEAL PDRN BOOSTER' },
  // Item 6 — no-image products: match by id since current names may be mangled
  // (FINASTE RIDE, Fere, etc.). We re-key these to (categoryId, currentName-substring).
  { namePattern: /^FINASTE\s*RIDE/i,                   categoryId: 'hair-treatment', label: 'FINASTERIDE Tab. 1mg' },
  { namePattern: /^JOLLA\s+HIGH\s+FREQUENCY/i,         categoryId: 'salon-grade', label: 'JOLLA HIGH FREQUENCY MASSAGE CREAM' },
  { namePattern: /^Product 292$/i,                     categoryId: 'salon-grade', label: 'JOLLA PREMIUM OLIVE MASSAGE CREAM (placeholder)' },
  { namePattern: /^Fere$/i,                            categoryId: 'injections',  label: 'Ferex inj' },
  { namePattern: /^ARGININE\s+INJ\./i,                 categoryId: 'injections',  label: 'ARGININE INJ.' },
  { namePattern: /^Product 406$/i,                     categoryId: 'placental-therapy', label: 'REJUVE Inj. (placeholder)' },
  { namePattern: /^EVERLINE\s+MEZO\s+NEEDLE$/i,        categoryId: 'nano-needle-cannula', label: 'EVERLINE MEZO NEEDLE' },
];

function applyDeletions(products: JsonProduct[]): { kept: JsonProduct[]; deleted: JsonProduct[]; missed: string[] } {
  const deleted: JsonProduct[] = [];
  const missed: string[] = [];
  for (const rule of DELETIONS) {
    const idx = products.findIndex(p => p.categoryId === rule.categoryId && rule.namePattern.test(p.name));
    if (idx === -1) {
      missed.push(rule.label);
      continue;
    }
    deleted.push(products[idx]);
    products.splice(idx, 1);
  }
  return { kept: products, deleted, missed };
}
```

- [ ] **Step 3: Wire backup + deletions into main**

Replace `main` with:

```ts
function main(): void {
  const backupPath = backupDataFile();
  console.log(`repair-products: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as { products: JsonProduct[]; categories: unknown[] };
  const before = data.products.length;

  const { deleted, missed } = applyDeletions(data.products);
  console.log(`repair-products: deleted ${deleted.length} of ${DELETIONS.length} targets (missed ${missed.length})`);
  for (const m of missed) console.log(`  MISS: ${m}`);

  const txt = parseProductsTxt(PRODUCTS_TXT);
  const result = matchByCategoryThenOrdinal(data.products, txt);
  console.log(`repair-products: ${data.products.length} products remaining (was ${before})`);
  console.log(`  matches: ${result.matches.length}, unmatched products: ${result.unmatchedProducts.length}, unmatched entries: ${result.unmatchedEntries.length}`);

  // No write yet — Task 5 wires it.
}
```

- [ ] **Step 4: Run and verify**

Run: `npx tsx scripts/repair-products.ts`

Expected output includes:
- `deleted 16 of 16 targets (missed 0)`
- `422 products remaining (was 438)`
- backup file appears in `data/backups/`
- The matched counts in the per-category report are equal to (or within 1 of) the new product counts

If `missed` is non-zero, the `namePattern` for the missed entry is wrong; inspect the current `name` of the affected product in `data/products.json` and adjust the regex.

- [ ] **Step 5: Restore the backup (we did not write to products.json)**

The script doesn't write yet, so `data/products.json` is untouched. But the backup file in `data/backups/` is real; leave it — it documents the pre-repair state.

- [ ] **Step 6: Commit**

```bash
git add scripts/repair-products.ts
git commit -m "feat(scripts): repair-products backup + deletion list"
```

---

## Task 5: Apply name/spec rewrites + description regeneration

**Files:**
- Modify: `scripts/repair-products.ts`

- [ ] **Step 1: Add the rewrite function**

Add to `scripts/repair-products.ts` (above `main`):

```ts
interface RewriteCounters {
  nameFixes: number;
  specFixes: number;
  descRegenerated: number;
  groupCleanup: number;
}

function applyRewrites(
  matches: Array<{ product: JsonProduct; entry: { name: string; spec: string } }>,
): RewriteCounters {
  const counters: RewriteCounters = { nameFixes: 0, specFixes: 0, descRegenerated: 0, groupCleanup: 0 };

  for (const { product, entry } of matches) {
    const oldName = product.name;
    const oldSpec = product.specification;
    const nameChanged = oldName !== entry.name;
    const specChanged = entry.spec && entry.spec !== oldSpec;

    if (nameChanged) {
      product.name = entry.name;
      counters.nameFixes++;
    }
    if (specChanged) {
      product.specification = entry.spec;
      counters.specFixes++;
    }
    // Regenerate description only if name was wrong AND the old name appears in description.
    if (nameChanged && typeof product.description === 'string' && product.description.includes(oldName)) {
      product.description = `${entry.name} is a professional-use product distributed for licensed practitioners. Specification: ${entry.spec || oldSpec || 'on file'}.`;
      counters.descRegenerated++;
    }
  }

  return counters;
}

function cleanupOrphanedGroups(products: JsonProduct[]): number {
  const groupCounts = new Map<string, JsonProduct[]>();
  for (const p of products) {
    const gid = p.groupId as string | undefined;
    if (!gid) continue;
    const arr = groupCounts.get(gid) ?? [];
    arr.push(p);
    groupCounts.set(gid, arr);
  }
  let cleaned = 0;
  for (const [gid, members] of groupCounts) {
    if (members.length <= 1) {
      for (const m of members) {
        delete m.groupId;
        delete m.variantLabel;
        delete m.groupName;
        delete m.groupImage;
      }
      cleaned += members.length;
    }
  }
  return cleaned;
}
```

- [ ] **Step 2: Wire writes into main**

Replace `main` with the full pipeline:

```ts
function main(): void {
  const backupPath = backupDataFile();
  console.log(`repair-products: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as { products: JsonProduct[]; categories: unknown[] };
  const before = data.products.length;

  const { deleted, missed } = applyDeletions(data.products);
  if (missed.length > 0) {
    console.error(`repair-products: ${missed.length} deletion target(s) not found, aborting before write:`);
    for (const m of missed) console.error(`  MISS: ${m}`);
    process.exit(1);
  }
  console.log(`repair-products: deleted ${deleted.length} products`);

  const txt = parseProductsTxt(PRODUCTS_TXT);
  const result = matchByCategoryThenOrdinal(data.products, txt);

  const counters = applyRewrites(result.matches);
  counters.groupCleanup = cleanupOrphanedGroups(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`repair-products: wrote ${data.products.length} products (was ${before})`);
  console.log(`  name fixes: ${counters.nameFixes}`);
  console.log(`  spec fixes: ${counters.specFixes}`);
  console.log(`  description regenerations: ${counters.descRegenerated}`);
  console.log(`  group cleanup (single-member groups flattened): ${counters.groupCleanup}`);
  console.log(`  unmatched products: ${result.unmatchedProducts.length}`);
  if (result.unmatchedProducts.length > 0) {
    for (const p of result.unmatchedProducts) console.log(`    UNMATCHED #${p.id} (${p.categoryId}): ${p.name}`);
  }
}
```

- [ ] **Step 3: Run on a clean working tree**

```bash
git status   # should be clean before running
npx tsx scripts/repair-products.ts
```

Expected output:
- `deleted 16 products`
- `wrote 422 products`
- Non-zero counts for `name fixes` (~15+), `spec fixes`, `description regenerations`
- `unmatched products: 0` (or a small handful — investigate each before continuing)

- [ ] **Step 4: Spot-inspect critical fixes**

Run these greps against the new `data/products.json` and verify each shows the corrected name:

```bash
git diff data/products.json | grep -E '"name":' | head -40
```

Specific products to verify (use `grep '"id": N' -A 1 data/products.json` for each):
- `id 70` → no longer `Product 70`
- `id 103` → `MISADI CO2 Mask` (or whatever products.txt says, line 109)
- `id 141` → no longer `Product 141`
- `id 152` → **gone** (deleted)
- `id 203` → no longer `Product 203`
- `id 290` → **gone** (deleted)
- `id 292` → **gone** (deleted)
- `id 342` → **gone** (deleted)
- `id 357` → no longer just `C`
- `id 379` → **gone** (deleted)
- `id 406` → **gone** (deleted)
- `id 411` → **gone** (deleted)

If anything looks wrong, restore from `data/backups/products-<stamp>.json`, fix the script, and re-run.

- [ ] **Step 5: Verify idempotence**

Run the script again:

```bash
npx tsx scripts/repair-products.ts
```

Expected: a NEW backup file, but `name fixes: 0`, `spec fixes: 0` (or very few — every match that was correctly applied now sees `oldName === entry.name` and skips). `deleted 0 products` is NOT correct here — re-running tries to delete again and finds them missing. Adjust by reading: the second run will exit non-zero with `missed 16`. That is the intended idempotency signal — the user knows not to run twice. Document this in the script header comment.

Edit `scripts/repair-products.ts` to add this comment at the top:

```ts
/**
 * One-shot data repair.
 *
 * Running this against an already-repaired data file aborts with a "missed N
 * deletions" error — that is by design. The DELETIONS list is what makes this
 * non-idempotent. To re-run, restore from a backup in data/backups/ first.
 */
```

- [ ] **Step 6: Commit**

```bash
git add scripts/repair-products.ts data/products.json
git commit -m "feat(scripts): apply repair pipeline (delete 16, fix names/specs/descs)"
```

---

## Task 6: Image auto-mapping + manual-mapping report

**Files:**
- Modify: `scripts/repair-products.ts`
- Create: `scripts/lib/repair-report.ts`

- [ ] **Step 1: Write the report helper**

Create `scripts/lib/repair-report.ts`:

```ts
import type { JsonProduct } from './match-products';

export interface ImageReport {
  autoMapped: Array<{ file: string; productId: number; targetPath: string }>;
  needsManual: Array<{ file: string; candidates: Array<{ id: number; name: string; score: number }> }>;
}

export function formatReport(
  imageReport: ImageReport,
  unmatched: JsonProduct[],
): string {
  const lines: string[] = [];
  lines.push('# repair-products report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Auto-mapped images (${imageReport.autoMapped.length})`);
  for (const r of imageReport.autoMapped) {
    lines.push(`  ${r.file}  →  #${r.productId}  →  ${r.targetPath}`);
  }
  lines.push('');
  lines.push(`## Manual-mapping required (${imageReport.needsManual.length})`);
  for (const r of imageReport.needsManual) {
    lines.push(`  ${r.file}`);
    for (const c of r.candidates) {
      lines.push(`     candidate #${c.id} score=${c.score} ${c.name}`);
    }
  }
  lines.push('');
  lines.push(`## Unmatched products (${unmatched.length})`);
  for (const p of unmatched) lines.push(`  #${p.id} (${p.categoryId}) ${p.name}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 2: Implement image mapping**

Add to `scripts/repair-products.ts` (above `main`):

```ts
import { formatReport, type ImageReport } from './lib/repair-report';

const NUMBERED_RE = /(\d+)\s*product/i;

function mapImages(products: JsonProduct[]): ImageReport {
  const autoMapped: ImageReport['autoMapped'] = [];
  const needsManual: ImageReport['needsManual'] = [];
  const byId = new Map<number, JsonProduct>();
  for (const p of products) byId.set(p.id, p);

  if (!fs.existsSync(MISSING_FINDS)) return { autoMapped, needsManual };
  const files = fs.readdirSync(MISSING_FINDS).filter(f => !f.startsWith('.'));

  for (const file of files) {
    const src = path.join(MISSING_FINDS, file);
    if (!fs.statSync(src).isFile()) continue;
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) continue;

    const numMatch = NUMBERED_RE.exec(file);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      const product = byId.get(id);
      if (!product) continue;            // deleted or out of range
      const targetName = `product-${id}${ext}`;
      const targetPath = path.join(IMG_DIR, targetName);
      const existing = product.image as string | undefined;
      const targetExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
      if (!targetExists && !existing) {
        fs.copyFileSync(src, targetPath);
        product.image = `/images/products/${targetName}`;
        autoMapped.push({ file, productId: id, targetPath: product.image as string });
      }
      continue;
    }

    // No number — rank by simple token-overlap score.
    const stem = file.replace(ext, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const tokens = new Set(stem.split(' ').filter(t => t.length >= 3));
    const scored = products
      .filter(p => !(p.image as string | undefined))
      .map(p => {
        const nameTokens = new Set(String(p.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length >= 3));
        let score = 0;
        for (const t of tokens) if (nameTokens.has(t)) score++;
        return { id: p.id, name: p.name as string, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    needsManual.push({ file, candidates: scored });
  }

  return { autoMapped, needsManual };
}
```

- [ ] **Step 3: Wire image-mapping + report into main**

Replace the trailing lines of `main` with:

```ts
  const imageReport = mapImages(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`repair-products: wrote ${data.products.length} products`);
  console.log(`  name/spec/desc fix counters: name=${counters.nameFixes} spec=${counters.specFixes} desc=${counters.descRegenerated} groups=${counters.groupCleanup}`);
  console.log(`  images auto-mapped: ${imageReport.autoMapped.length}`);
  console.log(`  images needing manual mapping: ${imageReport.needsManual.length}`);

  const reportText = formatReport(imageReport, result.unmatchedProducts);
  fs.writeFileSync(REPORT_PATH, reportText, 'utf8');
  console.log(`repair-products: report → ${REPORT_PATH}`);
```

(The `fs.writeFileSync(DATA_FILE, ...)` line should appear exactly once — remove the earlier write added in Task 5 step 2 if both are present.)

- [ ] **Step 4: Run and inspect**

Run: `npx tsx scripts/repair-products.ts`

Expected:
- `images auto-mapped` ≥ 14 (count the files in `missing finds/` matching `\d+product` — there are at least 14: 286, 267, 226, 149, 386, 321, 309, 287, 245, 322, 208, 203, 70, 141)
- `images needing manual mapping` is non-zero (the unnumbered files)
- `scripts/repair-products-report.txt` exists and is readable

Open the report and verify:
- Auto-mapped section lists files that were copied (and the target paths are correct)
- Manual section lists candidates that make some sense (e.g. `Adimis-Body-Filler.jpg` → top candidates include the AdiMis Body product)

- [ ] **Step 5: Confirm the script is destructive-but-recoverable**

Verify a backup file exists in `data/backups/products-*.json` from this run.

If anything in the report looks wrong, restore from the most recent backup:

```bash
cp data/backups/products-<stamp>.json data/products.json
```

And restart from Task 5 step 3.

- [ ] **Step 6: Commit**

```bash
git add scripts/repair-products.ts scripts/lib/repair-report.ts data/products.json public/images/products/ scripts/repair-products-report.txt
git commit -m "feat(scripts): image auto-mapping + manual-mapping report"
```

---

## Task 7: Validation pass

**Files:**
- Modify: `scripts/repair-products.ts`

- [ ] **Step 1: Add the validator**

Add to `scripts/repair-products.ts` (above `main`):

```ts
interface ValidationFailure { kind: string; detail: string }

function validate(data: { products: JsonProduct[]; categories: Array<{ id: string }> }): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  // 1. Every category has at least one product.
  for (const cat of data.categories) {
    const n = data.products.filter(p => p.categoryId === cat.id).length;
    if (n === 0) failures.push({ kind: 'empty-category', detail: cat.id });
  }

  // 2. No surviving broken-name patterns.
  for (const p of data.products) {
    if (isBrokenName(p.name)) failures.push({ kind: 'broken-name', detail: `#${p.id} ${p.name}` });
  }

  // 3. Deletion targets are absent.
  for (const rule of DELETIONS) {
    if (data.products.some(p => p.categoryId === rule.categoryId && rule.namePattern.test(p.name))) {
      failures.push({ kind: 'undeleted', detail: rule.label });
    }
  }

  // 4. Every groupId has either 0 or >=2 members.
  const groups = new Map<string, number>();
  for (const p of data.products) {
    const gid = p.groupId as string | undefined;
    if (gid) groups.set(gid, (groups.get(gid) ?? 0) + 1);
  }
  for (const [gid, n] of groups) {
    if (n < 2) failures.push({ kind: 'orphan-group', detail: `${gid} has ${n} member(s)` });
  }

  return failures;
}
```

Note: `isBrokenName` is imported from `./lib/match-products`. Add it to the imports at the top:

```ts
import { matchByCategoryThenOrdinal, isBrokenName, type JsonProduct } from './lib/match-products';
```

- [ ] **Step 2: Wire validation as the last step of `main`**

Append to the end of `main`:

```ts
  const failures = validate(data as never);
  if (failures.length > 0) {
    console.error(`repair-products: ${failures.length} validation failure(s):`);
    for (const f of failures) console.error(`  [${f.kind}] ${f.detail}`);
    process.exit(2);
  }
  console.log('repair-products: validation passed');
```

- [ ] **Step 3: Run end-to-end**

Restore from backup first to start from a clean baseline:

```bash
cp data/backups/products-<earliest-stamp>.json data/products.json
npx tsx scripts/repair-products.ts
```

Expected: ends with `repair-products: validation passed` and exits 0.

If validation fails:
- `empty-category` → the deletion list removed everything from a category; check `DELETIONS`
- `broken-name` → matching missed a product; inspect the report and adjust the parser or the broken-pattern list
- `undeleted` → a deletion regex didn't match the current name; adjust the regex
- `orphan-group` → group cleanup didn't run or is buggy

- [ ] **Step 4: Commit**

```bash
git add scripts/repair-products.ts
git commit -m "feat(scripts): repair-products validation pass"
```

---

## Task 8: Disable Russian auto-detection

**Files:**
- Modify: `proxy.ts:7-11`

- [ ] **Step 1: Read the current middleware config**

Open `proxy.ts` and confirm the `createMiddleware` call currently reads:

```ts
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
```

- [ ] **Step 2: Add `localeDetection: false`**

Edit `proxy.ts`. Change the `createMiddleware` call to:

```ts
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});
```

- [ ] **Step 3: Verify the dev server picks it up**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -sI -H 'Accept-Language: ru-RU' http://localhost:3000/ | grep -i location
```

Expected: `Location: /en` (not `/ru`). Test again with `-H 'Accept-Language: ko-KR'` — should still redirect to `/en`.

Manual check in a browser:
- Open `http://localhost:3000/` from a Russian-language profile → lands on `/en`.
- Click the RU switcher → URL becomes `/ru/...` and the page renders Russian content (manual choice still works).
- Close the tab, reopen, hit `http://localhost:3000/` → back to `/en` (no sticky Russian).

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "fix(i18n): disable Accept-Language auto-detection; default to /en"
```

---

## Task 9: URL-driven catalogue filter state

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

- [ ] **Step 1: Read the current implementation**

Open `components/catalogue/CatalogueClient.tsx`. Confirm the file currently:
- Reads only `q` from `useSearchParams()` at line ~33
- Calls `router.replace` only inside `handleSearch` at line ~138-146
- Stores `activeCategory`, `saleOnly`, `newOnly`, `groupedOnly`, `sortBy`, `page` as React state with no URL sync

- [ ] **Step 2: Add the URL sync helper**

Find the block immediately above `handleSearch` (around line 137). Replace the existing `handleSearch` definition and the related state initialisation with the following diff.

Replace the existing state-init block (lines ~33-42):

```tsx
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(initialCategory || '');
  const [saleOnly, setSaleOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [groupedOnly, setGroupedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
```

with:

```tsx
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(
    initialCategory || searchParams.get('cat') || '',
  );
  const [saleOnly, setSaleOnly] = useState(searchParams.get('sale') === '1');
  const [newOnly, setNewOnly] = useState(searchParams.get('new') === '1');
  const [groupedOnly, setGroupedOnly] = useState(searchParams.get('grouped') === '1');
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'default',
  );
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);
```

- [ ] **Step 3: Add the `updateUrl` callback and rewire setters**

Insert immediately after the `useMemo`/`useCallback` blocks (right before `handleSearch`):

```tsx
  const updateUrl = useCallback(
    (patch: Partial<{ q: string; cat: string; sale: boolean; new: boolean; grouped: boolean; sort: SortOption; page: number }>) => {
      const params = new URLSearchParams(searchParams.toString());
      const apply = (key: string, value: unknown, isDefault: (v: unknown) => boolean) => {
        if (isDefault(value)) params.delete(key);
        else params.set(key, String(value));
      };
      if ('q' in patch) apply('q', patch.q, v => !v);
      if ('cat' in patch) apply('cat', patch.cat, v => !v);
      if ('sale' in patch) apply('sale', patch.sale ? '1' : '', v => v !== '1');
      if ('new' in patch) apply('new', patch.new ? '1' : '', v => v !== '1');
      if ('grouped' in patch) apply('grouped', patch.grouped ? '1' : '', v => v !== '1');
      if ('sort' in patch) apply('sort', patch.sort, v => !v || v === 'default');
      if ('page' in patch) apply('page', patch.page, v => !v || v === 1);
      const qs = params.toString();
      router.replace(qs ? `/${locale}/catalogue?${qs}` : `/${locale}/catalogue`, { scroll: false });
    },
    [locale, router, searchParams],
  );
```

- [ ] **Step 4: Replace `handleSearch` and `handleCategoryClick`**

Replace `handleSearch` (around line 138) with:

```tsx
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
    updateUrl({ q, page: 1 });
  }, [updateUrl]);
```

Replace `handleCategoryClick` (around line 148) with:

```tsx
  const handleCategoryClick = (catId: string) => {
    const next = activeCategory === catId ? '' : catId;
    setActiveCategory(next);
    setPage(1);
    setSidebarOpen(false);
    updateUrl({ cat: next, page: 1 });
  };
```

- [ ] **Step 5: Sync sale/new/grouped/sort/page inline**

For each of the four checkbox handlers (lines ~257, ~265, ~274) and the sort `<select>` (line ~342) and the pagination buttons (lines ~459, ~475, ~487), add the corresponding `updateUrl({...})` call right next to the existing `setSaleOnly`/`setNewOnly`/`setGroupedOnly`/`setSortBy`/`setPage` call. Show:

```tsx
// Sale checkbox
onChange={e => { setSaleOnly(e.target.checked); setPage(1); updateUrl({ sale: e.target.checked, page: 1 }); }}

// New checkbox
onChange={e => { setNewOnly(e.target.checked); setPage(1); updateUrl({ new: e.target.checked, page: 1 }); }}

// Grouped checkbox
onChange={e => { setGroupedOnly(e.target.checked); setPage(1); updateUrl({ grouped: e.target.checked, page: 1 }); }}

// Sort
onChange={e => { const v = e.target.value as SortOption; setSortBy(v); setPage(1); updateUrl({ sort: v, page: 1 }); }}

// Pagination prev
onClick={() => { const p = Math.max(1, page - 1); setPage(p); updateUrl({ page: p }); window.scrollTo(0, 0); }}

// Pagination page buttons
onClick={() => { setPage(pageNum); updateUrl({ page: pageNum }); window.scrollTo(0, 0); }}

// Pagination next
onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); updateUrl({ page: p }); window.scrollTo(0, 0); }}
```

- [ ] **Step 6: Update `clearFilters`**

Replace `clearFilters` (around line 154) with:

```tsx
  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('');
    setSaleOnly(false);
    setNewOnly(false);
    setGroupedOnly(false);
    setSortBy('default');
    setPage(1);
    router.replace(`/${locale}/catalogue`, { scroll: false });
  };
```

- [ ] **Step 7: Update the "active category badge" close button**

Replace the `onClick` on the `<X />` button at line ~396 with:

```tsx
onClick={() => { setActiveCategory(''); updateUrl({ cat: '' }); }}
```

- [ ] **Step 8: Manual browser verification**

```bash
npm run dev
```

In a browser:
- Visit `/en/catalogue` → URL has no query.
- Type `regenovue` in search → URL becomes `/en/catalogue?q=regenovue`.
- Click Fillers in sidebar → URL becomes `/en/catalogue?q=regenovue&cat=fillers`.
- Check Sale Only → URL becomes `…&sale=1`.
- Change Sort to Price Asc → URL becomes `…&sort=price-asc`.
- Click page 2 → URL becomes `…&page=2`.
- Reload the page → all filters and page state restore from the URL.
- Press Clear → URL is back to `/en/catalogue`.

- [ ] **Step 9: Commit**

```bash
git add components/catalogue/CatalogueClient.tsx
git commit -m "feat(catalogue): persist all filters in URL query string"
```

---

## Task 10: Preserve search/filter on Back to Catalogue

**Files:**
- Modify: `components/catalogue/BackToCatalogueButton.tsx`

- [ ] **Step 1: Read the current component**

Open `components/catalogue/BackToCatalogueButton.tsx`. Confirm it currently only matches `/[locale]/catalogue/[category]/?` and discards the query string.

- [ ] **Step 2: Rewrite the referrer parser**

Replace the entire `useEffect` body (lines 26-53) with:

```tsx
  useEffect(() => {
    const referrer = document.referrer;
    if (!referrer) return;

    let url: URL;
    try { url = new URL(referrer); } catch { return; }
    if (url.origin !== window.location.origin) return;

    // /[locale]/catalogue or /[locale]/catalogue/[category]
    const m = url.pathname.match(/^\/[^/]+\/catalogue(?:\/([^/]+))?\/?$/);
    if (!m) return;

    const categoryId = m[1];
    const categoryName = categoryId ? categoriesById[categoryId] : undefined;
    const href = url.pathname + url.search;
    const label = categoryName ? `Back to ${categoryName}` : 'Back to Catalogue';

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget({ href, label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Manual browser verification**

```bash
npm run dev
```

In a browser, with the URL-driven catalogue from Task 9 already in place:
- `/en/catalogue?q=regenovue&cat=fillers&page=2` → click into any product card → on the product detail page, click *Back to ...* → land on `/en/catalogue?q=regenovue&cat=fillers&page=2` (URL unchanged).
- Label reads `Back to Fillers`.
- Same flow from `/en/catalogue/fillers?q=regenovue` works too.

- [ ] **Step 4: Commit**

```bash
git add components/catalogue/BackToCatalogueButton.tsx
git commit -m "feat(catalogue): preserve search/filter when navigating back"
```

---

## Task 11: Manual end-to-end verification

**Files:**
- None modified (this is the gate before the PR)

- [ ] **Step 1: Boot the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Locale check**

Open `http://localhost:3000/` in a browser whose Accept-Language prefers Russian (or curl with `-H 'Accept-Language: ru-RU'`). Expected: redirects to `/en`. Close and reopen — still `/en`.

- [ ] **Step 3: Visual scan for repaired names**

Open `/en/catalogue` and:
- Sort by Name → scroll the top of the list. No entries titled `Product 70`, `Product 141`, `Product 203`, etc.
- Search `Misadi` → confirm `MISADI CO2 Mask` shows (id 103).
- Search `Cindella` → confirm id 357 shows a real name (no longer single-letter `C`).
- Open the Hair Treatment category → FINASTERIDE Tab is absent.
- Open Salon-Grade → JOLLA HIGH FREQUENCY and JOLLA PREMIUM OLIVE are absent.
- Open Fillers → no TESORO products.
- Switch to mesotherapy/HA → TESORO COLLAGEN is still there; HANHEAL is not.

- [ ] **Step 4: Image auto-mapping spot-check**

Pick three product IDs from `scripts/repair-products-report.txt` Auto-mapped section. Open `/en/product/<id>` for each → confirm the image renders (not the placeholder).

- [ ] **Step 5: Search-state round trip**

`/en/catalogue?q=regenovue&cat=fillers&page=2` → click any product → click *Back to Fillers* → URL is unchanged, the page shows the same filtered list and is on page 2.

- [ ] **Step 6: Sidebar product counts**

In the sidebar of `/en/catalogue`, confirm "All Categories" shows `422` (was 438), the per-category counts have dropped where deletions occurred (Fillers `-7`, Mesotherapy `-2`, Hair Treatment `-1`, Salon-Grade `-2`, Injections `-2`, Placental Therapy `-1`, Nano Needle and Cannula `-1`).

- [ ] **Step 7: If anything fails**

Restore from the most-recent backup:

```bash
cp data/backups/products-<stamp>.json data/products.json
```

Investigate the failing case, fix the script/component, re-run, re-verify.

- [ ] **Step 8: Final commit (only if something needed touching here)**

If steps 1-6 all passed without changes, skip. Otherwise:

```bash
git add <changed-files>
git commit -m "fix: address verification finding in <area>"
```

---

## Out of scope (follow-up tickets)

- Resolving the `scripts/repair-products-report.txt` manual-mapping list — user will hand-confirm and we'll write a small `scripts/apply-manual-image-mapping.ts` in a separate session.
- Re-running translation generation for the renamed products in `data/translations/ru.json` and `ko.json`.
- Cleaning up `enrichedInfo` for products that don't populate it (none of the affected ones do today, but worth a sweep).
