# Variant Labels + Auto Image Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate `variantLabel` for every bundled product so dropdowns show distinguishing sizes/concentrations/counts, auto-map name-prefixed image files from `missing finds/`, and backfill `groupImage` from any populated variant image.

**Architecture:** Two standalone, idempotent Node scripts (`auto-map-name-images.ts` and `regen-variant-labels.ts`) that each take a JSON backup, rewrite `data/products.json` in place, and emit a per-script report under `scripts/`. Both share the same JSON shape and file conventions as the existing `repair-products.ts`.

**Tech Stack:** TypeScript executed via `tsx`. No test framework; verification is via script-side reports and manual browser spot-checks.

**Spec:** `docs/superpowers/specs/2026-05-19-variant-labels-and-images-design.md`

---

## File Structure

**New files:**
- `scripts/auto-map-name-images.ts` — one-shot script that copies name-prefixed images from `missing finds/` into `public/images/products/` and updates `data/products.json`.
- `scripts/auto-map-name-images-report.txt` — generated each run.
- `scripts/regen-variant-labels.ts` — one-shot script that rewrites `variantLabel` per variant and backfills `groupImage`.
- `scripts/regen-variant-labels-report.txt` — generated each run.

**Modified files:**
- `package.json` — add two npm script aliases.
- `data/products.json` — rewritten by each script.
- `public/images/products/` — new image copies (extension preserved, lowercased).
- `data/backups/products-{timestamp}.json` — auto-created per run.

**Read-only inputs:**
- `missing finds/` — user-supplied images.
- `scripts/repair-products-report.txt` — exists from earlier; only referenced for context, not parsed.

---

## Task 1: Package script aliases

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the two npm aliases**

Open `package.json`. After the line `"sync-existing-images": "tsx scripts/sync-existing-images.ts",` (added in the previous plan), insert two new entries:

```json
    "auto-map-name-images": "tsx scripts/auto-map-name-images.ts",
    "regen-variant-labels": "tsx scripts/regen-variant-labels.ts",
```

If `"sync-existing-images"` doesn't exist on the current branch, place the two new lines after `"repair-products"`.

- [ ] **Step 2: Verify JSON is still valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
```

Expected: no output (parse succeeded).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(scripts): add npm aliases for variant-label + image scripts"
```

---

## Task 2: auto-map-name-images skeleton + types

**Files:**
- Create: `scripts/auto-map-name-images.ts`

- [ ] **Step 1: Write the skeleton**

Create `scripts/auto-map-name-images.ts` with:

```ts
/**
 * One-shot pass: for every image in `missing finds/` whose filename does NOT
 * contain the `NNNproduct` numeric pattern, attempt to auto-map it to a
 * product whose first alphanumeric name token matches the file's first usable
 * token. Idempotent on the filesystem — never overwrites existing target files.
 *
 * Outcomes per file:
 *   - exactly-one matching product with empty `image` → copy + set image
 *   - multiple matches → ambiguous, report only
 *   - no matches → no-match, report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'auto-map-name-images-report.txt');

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const NUMBERED_RE = /\d+\s*product/i;
const SPLIT_RE = /[-_ ()]+/;

interface Product {
  id: number;
  name: string;
  image: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface AutoMapped { file: string; productId: number; targetPath: string }
interface Ambiguous { file: string; token: string; candidates: Array<{ id: number; name: string }> }
interface NoMatch { file: string; token: string }
interface NoToken { file: string }

interface Report {
  autoMapped: AutoMapped[];
  ambiguous: Ambiguous[];
  noMatch: NoMatch[];
  noToken: NoToken[];
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  console.log('auto-map-name-images: starting');
  // populated below
}

main();
```

- [ ] **Step 2: Smoke run**

```bash
npx tsx scripts/auto-map-name-images.ts
```

Expected: `auto-map-name-images: starting`. No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/auto-map-name-images.ts
git commit -m "feat(scripts): scaffold auto-map-name-images entry point"
```

---

## Task 3: Filename-token + product-token helpers

**Files:**
- Modify: `scripts/auto-map-name-images.ts`

- [ ] **Step 1: Add the token helpers above `main`**

Insert above `function main()`:

```ts
/** Lowercased first alphanumeric token of a string, with non-alphanumerics stripped. */
function productKey(name: string): string {
  const m = /[a-z0-9]+/i.exec(name);
  return m ? m[0].toLowerCase() : '';
}

/** Returns the first usable filename token (length >= 3) after splitting on common separators. */
function fileKey(stem: string): string {
  const parts = stem.split(SPLIT_RE).filter(Boolean);
  for (const p of parts) {
    if (p.length >= 3) return p.toLowerCase();
  }
  return '';
}
```

- [ ] **Step 2: Add a quick in-file sanity check**

Append inside `main` (replace the placeholder comment):

```ts
  // sanity: print a few key derivations
  const samples = [
    ['EVEHILO_CENTRE_1800x1800.webp', 'EVEHILO'],
    ['_2_XSOME_2.png', '2XSOME'],
    ['Adimis-Body-Filler.jpg', 'AdiMis'],
  ];
  for (const [file, name] of samples) {
    const stem = file.replace(path.extname(file), '');
    console.log(`  fileKey(${file}) = "${fileKey(stem)}"  productKey(${name}) = "${productKey(name)}"`);
  }
```

- [ ] **Step 3: Run and confirm output**

```bash
npx tsx scripts/auto-map-name-images.ts
```

Expected output should include:

```
  fileKey(EVEHILO_CENTRE_1800x1800.webp) = "evehilo"  productKey(EVEHILO) = "evehilo"
  fileKey(_2_XSOME_2.png) = "xsome"  productKey(2XSOME) = "2xsome"
  fileKey(Adimis-Body-Filler.jpg) = "adimis"  productKey(AdiMis) = "adimis"
```

Confirm `evehilo === evehilo` and `adimis === adimis` (will match). `xsome !== 2xsome` (won't match → ambiguous or no-match — fine).

- [ ] **Step 4: Remove the sample print**

Delete the sample block you just added. The helpers stay.

- [ ] **Step 5: Commit**

```bash
git add scripts/auto-map-name-images.ts
git commit -m "feat(scripts): productKey + fileKey helpers"
```

---

## Task 4: Mapping logic + report

**Files:**
- Modify: `scripts/auto-map-name-images.ts`

- [ ] **Step 1: Implement the mapping function**

Add above `main`:

```ts
function scanAndMap(products: Product[]): Report {
  const report: Report = { autoMapped: [], ambiguous: [], noMatch: [], noToken: [] };
  if (!fs.existsSync(MISSING_FINDS)) return report;

  const productIndex = new Map<string, Product[]>();
  for (const p of products) {
    const k = productKey(p.name);
    if (!k) continue;
    const list = productIndex.get(k) ?? [];
    list.push(p);
    productIndex.set(k, list);
  }

  const files = fs.readdirSync(MISSING_FINDS).filter(f => !f.startsWith('.'));
  for (const file of files) {
    const src = path.join(MISSING_FINDS, file);
    if (!fs.statSync(src).isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    if (!IMG_EXTS.has(ext)) continue;

    // Skip numeric files — handled by repair-products.ts.
    if (NUMBERED_RE.test(file)) continue;

    const stem = file.slice(0, file.length - path.extname(file).length);
    const token = fileKey(stem);
    if (!token) {
      report.noToken.push({ file });
      continue;
    }

    const candidates = (productIndex.get(token) ?? []).filter(p => !p.image);
    if (candidates.length === 0) {
      report.noMatch.push({ file, token });
      continue;
    }
    if (candidates.length > 1) {
      report.ambiguous.push({
        file,
        token,
        candidates: candidates.map(c => ({ id: c.id, name: c.name })),
      });
      continue;
    }

    const product = candidates[0];
    const targetName = `product-${product.id}${ext}`;
    const targetPath = path.join(IMG_DIR, targetName);
    const targetExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
    if (!targetExists) {
      fs.copyFileSync(src, targetPath);
    }
    product.image = `/images/products/${targetName}`;
    report.autoMapped.push({ file, productId: product.id, targetPath: product.image });
  }

  return report;
}
```

- [ ] **Step 2: Implement the report formatter**

Add above `main`:

```ts
function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# auto-map-name-images report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Auto-mapped (${r.autoMapped.length})`);
  for (const x of r.autoMapped) lines.push(`  ${x.file}  →  #${x.productId}  →  ${x.targetPath}`);
  lines.push('');
  lines.push(`## Ambiguous — multiple candidates (${r.ambiguous.length})`);
  for (const x of r.ambiguous) {
    lines.push(`  ${x.file}  (token=${x.token})`);
    for (const c of x.candidates) lines.push(`     candidate #${c.id} ${c.name}`);
  }
  lines.push('');
  lines.push(`## No match (${r.noMatch.length})`);
  for (const x of r.noMatch) lines.push(`  ${x.file}  (token=${x.token})`);
  lines.push('');
  lines.push(`## No usable token (${r.noToken.length})`);
  for (const x of r.noToken) lines.push(`  ${x.file}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 3: Wire into `main`**

Replace the body of `main()` with:

```ts
function main(): void {
  const backupPath = backupDataFile();
  console.log(`auto-map-name-images: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const report = scanAndMap(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');

  console.log(`auto-map-name-images: auto-mapped ${report.autoMapped.length}, ambiguous ${report.ambiguous.length}, no-match ${report.noMatch.length}, no-token ${report.noToken.length}`);
  console.log(`auto-map-name-images: report → ${REPORT_PATH}`);
}
```

- [ ] **Step 4: Run end-to-end**

```bash
npx tsx scripts/auto-map-name-images.ts
```

Expected: prints a non-zero `auto-mapped` count (expect at least 5–15 — EVEHILO, EXOXE, etc.); writes report to `scripts/auto-map-name-images-report.txt`.

- [ ] **Step 5: Spot-check the result**

```bash
grep -A 12 '"id": 80,' data/products.json | grep image
grep -A 12 '"id": 132,' data/products.json | grep image
head -30 scripts/auto-map-name-images-report.txt
```

Expect:
- id 80 → `"image": "/images/products/product-80.webp"`
- id 132 → `"image": "/images/products/product-132.webp"`
- Report header + auto-mapped section populated

- [ ] **Step 6: Verify idempotence**

Run a second time:

```bash
npx tsx scripts/auto-map-name-images.ts
```

Expect: `auto-mapped 0` (because every previously-mapped product now has a non-empty `image`, so it's no longer eligible). Other counts unchanged.

- [ ] **Step 7: Commit**

```bash
git add scripts/auto-map-name-images.ts data/products.json public/images/products/ scripts/auto-map-name-images-report.txt
git commit -m "feat(scripts): auto-map name-prefixed images from missing finds"
```

---

## Task 5: regen-variant-labels skeleton + types

**Files:**
- Create: `scripts/regen-variant-labels.ts`

- [ ] **Step 1: Write the skeleton**

Create `scripts/regen-variant-labels.ts` with:

```ts
/**
 * One-shot pass: for every product group (shared groupId), rewrite
 * `variantLabel` so it visibly distinguishes variants in the dropdown.
 *
 * Strategy per group:
 *   1. If every variant's `name` is unique within the group → variantLabel = name.
 *   2. Else, try to extract a unique label per variant from `specification`:
 *      size patterns first, then concentration %, then count units.
 *   3. If none of the three pattern families produces a fully unique set,
 *      fall back to "Variant N" labels and report the group.
 *   4. True duplicates (same name + same spec) are reported, not modified.
 *
 * Also backfills `groupImage`: if a group has any variant with a non-empty
 * `image`, copy that image into `groupImage` for every variant in the group.
 *
 * Idempotent — running on clean data is a no-op aside from a fresh backup.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'regen-variant-labels-report.txt');

interface Product {
  id: number;
  name: string;
  specification: string;
  groupId?: string;
  variantLabel?: string;
  groupImage?: string;
  image: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface Change { id: number; before: string; after: string }
interface DuplicateGroup { groupId: string; ids: number[]; name: string; spec: string }
interface FallbackGroup { groupId: string; ids: number[] }
interface ImageFilled { groupId: string; ids: number[]; image: string }

interface Report {
  changed: Change[];
  fallback: FallbackGroup[];
  duplicates: DuplicateGroup[];
  imageFilled: ImageFilled[];
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  console.log('regen-variant-labels: starting');
}

main();
```

- [ ] **Step 2: Smoke run**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expected: `regen-variant-labels: starting`. No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/regen-variant-labels.ts
git commit -m "feat(scripts): scaffold regen-variant-labels entry point"
```

---

## Task 6: Spec-token extraction helpers

**Files:**
- Modify: `scripts/regen-variant-labels.ts`

- [ ] **Step 1: Add the extractors above `main`**

```ts
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(mL|ml|g|mg|cc|kg|oz|L)\b/i;
const CONC_RE = /(\d+(?:\.\d+)?)\s*%/;
const COUNT_RE = /(?:x\s*)?(\d+)\s*(units?|U|IU|vials?|syr|syringes?|ampoules?|tabs?|sheets?|ea|pcs)\b/i;

function normaliseUnit(u: string): string {
  const lower = u.toLowerCase();
  if (lower === 'ml') return 'mL';
  if (lower === 'l') return 'L';
  return lower;
}

function extractSize(spec: string): string | null {
  const m = SIZE_RE.exec(spec);
  return m ? `${m[1]}${normaliseUnit(m[2])}` : null;
}

function extractConc(spec: string): string | null {
  const m = CONC_RE.exec(spec);
  return m ? `${m[1]}%` : null;
}

function extractCount(spec: string): string | null {
  const m = COUNT_RE.exec(spec);
  if (!m) return null;
  const unit = m[2].toLowerCase().replace(/s$/, '');
  return `${m[1]} ${unit}`;
}
```

- [ ] **Step 2: Wire a quick sanity check**

Replace the `console.log('regen-variant-labels: starting');` line in `main` with:

```ts
  const samples = [
    '100g, Lidocaine 25mg + Prilocaine 25mg',
    '10.56% x 500g',
    '10.56% x 30g',
    '100 units',
    '1.1 mL x 1 Syr, HA 24 mg/mL',
  ];
  for (const s of samples) {
    console.log(`  ${s.padEnd(50)} size=${extractSize(s)}  conc=${extractConc(s)}  count=${extractCount(s)}`);
  }
```

- [ ] **Step 3: Run and verify**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expected output (exact units may vary slightly on whitespace):

```
  100g, Lidocaine 25mg + Prilocaine 25mg              size=100g  conc=null  count=null
  10.56% x 500g                                       size=500g  conc=10.56%  count=null
  10.56% x 30g                                        size=30g  conc=10.56%  count=null
  100 units                                           size=null  conc=null  count=100 unit
  1.1 mL x 1 Syr, HA 24 mg/mL                         size=1.1mL  conc=null  count=1 syr
```

Confirm that size catches the first match, count survives, and concentration is detected.

- [ ] **Step 4: Remove the sample print**

Delete the sample block. The helpers stay.

- [ ] **Step 5: Commit**

```bash
git add scripts/regen-variant-labels.ts
git commit -m "feat(scripts): size/conc/count spec-token extractors"
```

---

## Task 7: Per-group label resolver

**Files:**
- Modify: `scripts/regen-variant-labels.ts`

- [ ] **Step 1: Add the group resolver**

Insert above `main`:

```ts
type Extractor = (spec: string) => string | null;
const EXTRACTORS: Array<{ key: 'size' | 'conc' | 'count'; fn: Extractor }> = [
  { key: 'size',  fn: extractSize },
  { key: 'conc',  fn: extractConc },
  { key: 'count', fn: extractCount },
];

/**
 * Resolve variantLabel for every member of one group.
 * Returns the new labels, plus metadata indicating which path was used.
 */
function resolveGroup(
  members: Product[],
): { labels: string[]; via: 'unique-name' | 'size' | 'conc' | 'count' | 'fallback' | 'duplicate' } {
  if (members.length === 0) return { labels: [], via: 'fallback' };

  // 1) Unique names?
  const names = members.map(p => p.name);
  if (new Set(names).size === names.length) {
    return { labels: names, via: 'unique-name' };
  }

  // 2) Try each spec extractor; require fully unique results across the group.
  for (const ex of EXTRACTORS) {
    const extracted = members.map(m => ex.fn(m.specification || ''));
    if (extracted.every(x => x !== null) && new Set(extracted).size === extracted.length) {
      return { labels: extracted as string[], via: ex.key };
    }
  }

  // 3) True-duplicate detection: same name AND same spec for every member.
  const specs = members.map(p => p.specification || '');
  const allSameName = new Set(names).size === 1;
  const allSameSpec = new Set(specs).size === 1;
  if (allSameName && allSameSpec) {
    return { labels: members.map(p => p.variantLabel ?? p.name), via: 'duplicate' };
  }

  // 4) Fallback — Variant N.
  return { labels: members.map((_, i) => `Variant ${i + 1}`), via: 'fallback' };
}
```

- [ ] **Step 2: Add an inline smoke check**

Replace the body of `main` with:

```ts
function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }

  let viaUnique = 0, viaSize = 0, viaConc = 0, viaCount = 0, viaFallback = 0, viaDup = 0;
  for (const [, members] of byGroup) {
    const { via } = resolveGroup(members);
    if (via === 'unique-name') viaUnique++;
    else if (via === 'size') viaSize++;
    else if (via === 'conc') viaConc++;
    else if (via === 'count') viaCount++;
    else if (via === 'fallback') viaFallback++;
    else if (via === 'duplicate') viaDup++;
  }
  console.log(`regen-variant-labels: groups=${byGroup.size} unique-name=${viaUnique} size=${viaSize} conc=${viaConc} count=${viaCount} fallback=${viaFallback} duplicate=${viaDup}`);
}
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expected: a non-zero total across categories. `fallback` should be small (single-digit). `duplicate` may be small. If `fallback` is large (>10), the extractors miss too many cases — STOP and inspect a sample.

- [ ] **Step 4: Commit**

```bash
git add scripts/regen-variant-labels.ts
git commit -m "feat(scripts): per-group variantLabel resolver"
```

---

## Task 8: Apply labels + backfill groupImage + report

**Files:**
- Modify: `scripts/regen-variant-labels.ts`

- [ ] **Step 1: Add the apply function**

Insert above `main`:

```ts
function applyLabels(byGroup: Map<string, Product[]>, report: Report): void {
  for (const [groupId, members] of byGroup) {
    const { labels, via } = resolveGroup(members);

    if (via === 'duplicate') {
      report.duplicates.push({
        groupId,
        ids: members.map(m => m.id),
        name: members[0].name,
        spec: members[0].specification ?? '',
      });
      continue; // do not overwrite existing labels
    }

    if (via === 'fallback') {
      report.fallback.push({ groupId, ids: members.map(m => m.id) });
    }

    for (let i = 0; i < members.length; i++) {
      const before = members[i].variantLabel ?? '';
      const after = labels[i];
      if (before !== after) {
        members[i].variantLabel = after;
        report.changed.push({ id: members[i].id, before, after });
      }
    }
  }
}

function backfillGroupImages(byGroup: Map<string, Product[]>, report: Report): void {
  for (const [groupId, members] of byGroup) {
    const firstImage = members.find(m => m.image && m.image.length > 0)?.image;
    if (!firstImage) continue;
    const filled: number[] = [];
    for (const m of members) {
      if ((m.groupImage ?? '') !== firstImage) {
        m.groupImage = firstImage;
        filled.push(m.id);
      }
    }
    if (filled.length > 0) {
      report.imageFilled.push({ groupId, ids: filled, image: firstImage });
    }
  }
}
```

- [ ] **Step 2: Add the report formatter**

Insert above `main`:

```ts
function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# regen-variant-labels report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Changed labels (${r.changed.length})`);
  for (const c of r.changed) lines.push(`  #${c.id}  "${c.before}" → "${c.after}"`);
  lines.push('');
  lines.push(`## Fallback "Variant N" groups (${r.fallback.length})`);
  for (const g of r.fallback) lines.push(`  group=${g.groupId}  ids=${g.ids.join(',')}`);
  lines.push('');
  lines.push(`## True duplicates — needs manual review (${r.duplicates.length})`);
  for (const d of r.duplicates) {
    lines.push(`  group=${d.groupId}  ids=${d.ids.join(',')}  name="${d.name}"  spec="${d.spec}"`);
  }
  lines.push('');
  lines.push(`## groupImage filled (${r.imageFilled.length})`);
  for (const i of r.imageFilled) lines.push(`  group=${i.groupId}  image=${i.image}  ids=${i.ids.join(',')}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 3: Replace `main` with the full pipeline**

```ts
function main(): void {
  const backupPath = backupDataFile();
  console.log(`regen-variant-labels: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }

  const report: Report = { changed: [], fallback: [], duplicates: [], imageFilled: [] };
  applyLabels(byGroup, report);
  backfillGroupImages(byGroup, report);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');

  console.log(`regen-variant-labels: groups=${byGroup.size} changed-labels=${report.changed.length} fallback=${report.fallback.length} duplicates=${report.duplicates.length} groupImage-filled=${report.imageFilled.length}`);
  console.log(`regen-variant-labels: report → ${REPORT_PATH}`);
}
```

- [ ] **Step 4: Run**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expected output (rough order of magnitude):
- `changed-labels` > 20 (lots of `MUCHCAINE` / `MUCHCAINE (MUCHCAINE)` etc. get replaced)
- `fallback` small (single digits)
- `duplicates` small (0-3)
- `groupImage-filled` > 5 (catches groups whose first member has an image but others don't)

- [ ] **Step 5: Spot-check MUCHCAINE**

```bash
grep -A 14 '"id": 397,' data/products.json | grep variantLabel
grep -A 14 '"id": 398,' data/products.json | grep variantLabel
grep -A 14 '"id": 399,' data/products.json | grep variantLabel
```

(Use whichever IDs your local MUCHCAINE variants have — check by searching for `"name": "MUCHCAINE"` first.)

Expected: three different values, e.g. `"100g"`, `"500g"`, `"30g"` (the resolver path is "size" — every MUCHCAINE spec has a different size, so size wins).

- [ ] **Step 6: Spot-check the report**

```bash
head -40 scripts/regen-variant-labels-report.txt
```

Should show the Changed section populated with `#id "before" → "after"` lines.

- [ ] **Step 7: Verify idempotence**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expect `changed-labels=0` and `groupImage-filled=0` on the second run.

- [ ] **Step 8: Commit**

```bash
git add scripts/regen-variant-labels.ts data/products.json scripts/regen-variant-labels-report.txt
git commit -m "feat(scripts): regen variantLabel + backfill groupImage"
```

---

## Task 9: Manual end-to-end verification

**Files:**
- None modified

- [ ] **Step 1: Boot the dev server (if not already running)**

```bash
npm run dev
```

- [ ] **Step 2: MUCHCAINE dropdown check**

Find the MUCHCAINE product page. `grep -n '"name": "MUCHCAINE"' data/products.json | head -3` to get an id. Open `/en/product/<id>` in a browser.

Expected: the variant dropdown shows `100g`, `500g`, `30g` (or with the price suffix). No `MUCHCAINE (MUCHCAINE)`.

- [ ] **Step 3: EVEHILO / EXOXE image check**

Open `/en/product/80` and `/en/product/132`. Both pages should now show an image (no broken-image placeholder).

- [ ] **Step 4: Bundle card image check**

Visit `/en/catalogue?cat=__bundles__`. Spot-check 10 random bundle cards. Each should show an image. The catalogue's `groupImage` fallback is now populated wherever possible.

- [ ] **Step 5: Re-check sidebar product count**

Sidebar's "All Categories" entry should still read `422` (unchanged by these scripts — they only modify per-product fields).

- [ ] **Step 6: If any of the above fails**

Restore from the most-recent backup:

```bash
ls data/backups/products-*.json | tail -1
```

Copy that file over `data/products.json` and investigate. The two scripts are independent, so you can restore and re-run either one.

- [ ] **Step 7: Final commit (only if something needed touching)**

If the verification surfaces an issue and you fix it in the scripts, commit the fix:

```bash
git add <changed-files>
git commit -m "fix: address verification finding in <area>"
```

If everything passed without changes, skip.

---

## Out of scope (follow-up tickets)

- True-duplicate variants flagged in `regen-variant-labels-report.txt` — user reviews the PDF and decides whether to merge or rewrite.
- Ambiguous-match files in `auto-map-name-images-report.txt` — user picks the correct product manually.
- Products that still have empty `image` after both scripts run (no prefix match in `missing finds/`) — separate image-sourcing pass.
