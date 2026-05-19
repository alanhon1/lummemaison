# Catalogue Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user's hand-curated bundle merges, bundle splits, image clears, image swaps, manual missing-finds mappings, and the CURENEX 224 deletion; fix the React duplicate-key error in bundle render; harden the catalogue search so unrelated products no longer match; and switch the back-to-catalogue button to a sessionStorage-based source.

**Architecture:** One consolidated data script (`scripts/catalogue-fixes.ts`) does all JSON/image work with a backup-first / idempotent approach. Three small UI patches handle the dual-view duplicate key, the Fuse search tightening, and the back-button source. Then `regen-variant-labels.ts` is re-run to refresh labels and groupImage for the newly-shaped groups.

**Tech Stack:** TypeScript via `tsx`, Next.js 16 App Router, next-intl, Fuse.js. No test framework — verification is via script reports plus manual browser checks.

**Spec:** `docs/superpowers/specs/2026-05-19-catalogue-fixes-design.md`

---

## File Structure

**New files:**
- `scripts/catalogue-fixes.ts` — one-shot data fix orchestrator.
- `scripts/catalogue-fixes-report.txt` — generated each run.

**Modified files:**
- `package.json` — add `"catalogue-fixes"` npm alias.
- `data/products.json` — rewritten by the script.
- `public/images/products/` — new image copies from `missing finds/`.
- `data/backups/products-{timestamp}.json` — auto-created.
- `components/catalogue/CatalogueClient.tsx` — search dual-view shape + Fuse options.
- `components/catalogue/ProductCard.tsx` — save catalogue URL on Link click.
- `components/catalogue/BackToCatalogueButton.tsx` — prefer sessionStorage.

**Read-only inputs:**
- `missing finds/` — user-supplied images.
- `products.txt` — name reference, not parsed here.

---

## Task 1: npm script alias

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the npm alias**

Open `package.json`. In the `scripts` block, add the following line right after the existing `"regen-variant-labels"` entry:

```json
    "catalogue-fixes": "tsx scripts/catalogue-fixes.ts",
```

- [ ] **Step 2: Verify JSON is still valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
```

Expected: no output (parse succeeded).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(scripts): add catalogue-fixes npm alias"
```

---

## Task 2: catalogue-fixes script — scaffold + backup + types

**Files:**
- Create: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Write the skeleton**

Create `scripts/catalogue-fixes.ts` with:

```ts
/**
 * One-shot consolidated catalogue data fix:
 *   - bundle merges (groupId assignments)
 *   - bundle splits (clear groupId / variantLabel / groupName / groupImage)
 *   - image clears (set image = "")
 *   - product delete (CURENEX SCULP 224)
 *   - image swaps (exchange image fields, no file moves)
 *   - manual missing-finds mappings (copy file + set image)
 *   - CURENEX 215-226 explicit variant labels
 *
 * Idempotent: every step checks "is this already applied?" before mutating.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'catalogue-fixes-report.txt');

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  variantLabel?: string;
  groupName?: string;
  groupImage?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface Report {
  merged: Array<{ id: number; from: string; to: string }>;
  split: Array<{ id: number; from: string }>;
  imageCleared: Array<{ id: number; was: string }>;
  deleted: Array<{ id: number; name: string }>;
  swapped: Array<{ a: number; b: number; aImage: string; bImage: string }>;
  manualMapped: Array<{ file: string; id: number; targetPath: string }>;
  manualSkipped: Array<{ file: string; id: number; reason: string }>;
  curenexLabels: Array<{ id: number; label: string }>;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  console.log('catalogue-fixes: starting');
  const backupPath = backupDataFile();
  console.log(`catalogue-fixes: backup → ${backupPath}`);
  // Populated by later tasks.
}

main();
```

- [ ] **Step 2: Smoke run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected output: `catalogue-fixes: starting` and a backup path. New backup file in `data/backups/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): scaffold catalogue-fixes script"
```

---

## Task 3: Bundle merges

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add the merge rules and the applier**

Above `main()`:

```ts
const BUNDLE_MERGES: ReadonlyArray<{ ids: readonly number[]; groupId: string }> = [
  { ids: [20, 21, 22, 23, 24],                          groupId: 'neuramis' },
  { ids: [38, 39, 40],                                  groupId: 'youthfill' },
  { ids: [44],                                          groupId: 'celosome' },
  { ids: [51, 52, 53, 54],                              groupId: 'chaeum' },
  { ids: [228, 229, 230, 231],                          groupId: 'dermagen-dermagen' },
  { ids: [323, 324],                                    groupId: 'meditoxin' },
  { ids: [325, 326],                                    groupId: 're-n-tox' },
];

function applyMerges(byId: Map<number, Product>, report: Report): void {
  for (const rule of BUNDLE_MERGES) {
    for (const id of rule.ids) {
      const p = byId.get(id);
      if (!p) continue;
      const before = (p.groupId ?? '') as string;
      if (before === rule.groupId) continue;
      p.groupId = rule.groupId;
      report.merged.push({ id, from: before || '(none)', to: rule.groupId });
    }
  }
}
```

- [ ] **Step 2: Wire into `main`**

Replace the placeholder comment in `main()` with the buildup of the report and the call:

```ts
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const byId = new Map<number, Product>();
  for (const p of data.products) byId.set(p.id, p);

  const report: Report = {
    merged: [], split: [], imageCleared: [], deleted: [],
    swapped: [], manualMapped: [], manualSkipped: [], curenexLabels: [],
  };

  applyMerges(byId, report);

  console.log(`catalogue-fixes: merged ${report.merged.length}`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `merged N` printed where N is 14-17 (all listed IDs minus any already-correctly-grouped). The data file is not yet written.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes bundle merges"
```

---

## Task 4: Bundle splits

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add the split rules and applier**

Above `main()`:

```ts
const BUNDLE_SPLITS: ReadonlyArray<number> = [89, 66, 103, 106, 387, 389];

function applySplits(byId: Map<number, Product>, report: Report): void {
  for (const id of BUNDLE_SPLITS) {
    const p = byId.get(id);
    if (!p) continue;
    if (!p.groupId) continue;
    const before = p.groupId as string;
    delete p.groupId;
    delete p.variantLabel;
    delete p.groupName;
    delete p.groupImage;
    report.split.push({ id, from: before });
  }
}
```

- [ ] **Step 2: Wire into `main`**

Append after the merges line:

```ts
  applySplits(byId, report);
  console.log(`catalogue-fixes: split ${report.split.length}`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `split N` printed. N is between 0 and 6 depending on current state.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes bundle splits"
```

---

## Task 5: Image clears

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add rule + applier**

Above `main()`:

```ts
const IMAGE_CLEARS: ReadonlyArray<number> = [
  3, 4, 17, 84, 216, 348, 349, 387, 408, 409, 410, 411,
];

function applyImageClears(byId: Map<number, Product>, report: Report): void {
  for (const id of IMAGE_CLEARS) {
    const p = byId.get(id);
    if (!p) continue;
    const was = p.image ?? '';
    if (!was) continue;
    p.image = '';
    report.imageCleared.push({ id, was });
  }
}
```

- [ ] **Step 2: Wire into `main`**

Append:

```ts
  applyImageClears(byId, report);
  console.log(`catalogue-fixes: image-cleared ${report.imageCleared.length}`);
```

- [ ] **Step 3: Run + verify**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `image-cleared N` with N matching the count of IDs that currently have a non-empty image. After this run the file isn't yet written; the verification is just the printed count.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes image clears"
```

---

## Task 6: Delete CURENEX SCULP 224

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add the deletion rule**

Above `main()`:

```ts
function applyDeletions(data: DataFile, byId: Map<number, Product>, report: Report): void {
  const target = byId.get(224);
  if (!target) return; // already deleted on a prior run
  if (!/^CURENEX\s+SCULP$/i.test(target.name)) {
    console.warn(`catalogue-fixes: id 224 name unexpected ("${target.name}") — skipping delete`);
    return;
  }
  const idx = data.products.findIndex(p => p.id === 224);
  if (idx >= 0) {
    data.products.splice(idx, 1);
    byId.delete(224);
    report.deleted.push({ id: 224, name: target.name });
  }
}
```

- [ ] **Step 2: Wire into `main`**

Append:

```ts
  applyDeletions(data, byId, report);
  console.log(`catalogue-fixes: deleted ${report.deleted.length}`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `deleted 1` on first run; `deleted 0` on subsequent runs.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes delete CURENEX SCULP 224"
```

---

## Task 7: Image swaps

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add rules + applier**

Above `main()`:

```ts
const IMAGE_SWAPS: ReadonlyArray<[number, number]> = [
  [21, 22],
  [66, 103],
  [119, 121],
];

function applyImageSwaps(byId: Map<number, Product>, report: Report): void {
  for (const [a, b] of IMAGE_SWAPS) {
    const pa = byId.get(a);
    const pb = byId.get(b);
    if (!pa || !pb) continue;
    const aImage = pa.image ?? '';
    const bImage = pb.image ?? '';
    if (aImage === bImage) continue; // nothing to do (or already swapped twice)
    pa.image = bImage;
    pb.image = aImage;
    report.swapped.push({ a, b, aImage: bImage, bImage: aImage });
  }
}
```

Note this is NOT fully idempotent — running twice would swap back. We
accept that because the script as a whole is meant to be run once and
the deletion step (Task 6) makes the whole run non-idempotent anyway.

- [ ] **Step 2: Wire into `main`**

Append:

```ts
  applyImageSwaps(byId, report);
  console.log(`catalogue-fixes: swapped ${report.swapped.length}`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `swapped 3` (assuming all three pairs differ).

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes image swaps"
```

---

## Task 8: Manual missing-finds mappings

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add rules + applier**

Above `main()`:

```ts
const MANUAL_MAPPINGS: ReadonlyArray<{ file: string; id: number; expectedName?: string }> = [
  { file: 'Adimis-Body-Filler.jpg',                                                                              id: 67,  expectedName: 'AdiMis' },
  { file: 'maxy-fill-2.webp',                                                                                    id: 69,  expectedName: 'MAXY FILL' },
  { file: 'ULTRAGEN_X_Middle.webp',                                                                              id: 84,  expectedName: 'ULTRA GEN' },
  { file: 'neuramis light(meso).jpg',                                                                            id: 20,  expectedName: 'NEURAMIS LIGHT (MESO)' },
  { file: 'Neuramis-Lidocain.jpg',                                                                               id: 21,  expectedName: 'NEURAMIS' },
  { file: 'neuramis deep lido.png',                                                                              id: 23,  expectedName: 'NEURAMIS DEEP WITH LIDOCAINE' },
  { file: 'REGENOVUE_SUB_Q.webp',                                                                                id: 5,   expectedName: 'REGENOVUE SUB-Q (CE)' },
  { file: 'eng_pl_Regenovue-Fine-Plus-1-1-ml-CE-94_1_1.jpg',                                                     id: 6,   expectedName: 'REGENOVUE FINE PLUS (CE)' },
  { file: 'eng_pl_Regenovue-Deep-Plus-1-1-ml-CE-97_1_1.jpg',                                                     id: 7,   expectedName: 'REGENOVUE DEEP PLUS (CE)' },
  { file: 'eng_pl_Regenovue-Sub-Q-Plus-1-1-ml-CE-96_1_1.jpg',                                                    id: 8,   expectedName: 'REGENOVUE SUB-Q PLUS (CE)' },
  { file: 'curenex-rejuvenating-cream-for-day-and-night-with-pdrn-4.06-fl-oz-getglowing-skincare__88885.jpg',    id: 218, expectedName: 'CURENEX REJUVENATING CREAM' },
  { file: 'dermagen-well.jpg',                                                                                   id: 233 },
  { file: 'dermagen urea cream deep.jpg',                                                                        id: 235 },
  { file: 'dermagen lunatox (not lunato).jpg',                                                                   id: 239 },
  { file: 'PEPTICULE ULTIMATE REJUVENATION CREAM.webp',                                                          id: 264 },
  { file: 'PEPTICULE ULTIMATE REJUVENATION SERUM.png',                                                           id: 265 },
  { file: 'vns lipolyticsolution vns fat.jpg',                                                                   id: 307, expectedName: 'VNS' },
  { file: 'meditoxin-200u-botox-injections.jpg',                                                                 id: 324 },
  { file: 'MASI Injection 10% (Magnesium.jpg',                                                                   id: 338 },
  { file: 'CHIOCTOCIN_INJ_2.jpg',                                                                                id: 386 },
  { file: 'Zinc S Inj..jpg',                                                                                     id: 382 },
  { file: 'CORETOX_100U___MEDYTOX__2.png',                                                                       id: 334 },
  { file: 'multivita-lyophilized.jpg',                                                                           id: 372 },
  { file: 'regenovue-aqua-shine-plus-getglowing-skincare__30485.jpg',                                            id: 91 },
  { file: 'regenovue-aqua-shine-silver-9ml-getglowing-skincare__07632.jpg',                                      id: 92 },
  { file: 'regenovue-pn-non.jpg',                                                                                id: 90 },
  { file: 'revolax-sub-q-with-lidocaine-12.webp',                                                                id: 28 },
  { file: 'vanhalla niacinamide skin tone balance.webp',                                                         id: 195 },
  { file: 'elaxenpllaaestheticsukforskin.jpg',                                                                   id: 101 },
];

function applyManualMappings(byId: Map<number, Product>, report: Report): void {
  for (const rule of MANUAL_MAPPINGS) {
    const src = path.join(MISSING_FINDS, rule.file);
    if (!fs.existsSync(src)) {
      report.manualSkipped.push({ file: rule.file, id: rule.id, reason: 'source file missing' });
      continue;
    }
    const product = byId.get(rule.id);
    if (!product) {
      report.manualSkipped.push({ file: rule.file, id: rule.id, reason: 'product id not found' });
      continue;
    }
    const ext = path.extname(rule.file).toLowerCase();
    const targetName = `product-${rule.id}${ext}`;
    const targetPath = path.join(IMG_DIR, targetName);

    // Drop any other product-<id>.<otherExt> files to avoid stale matches.
    for (const e of ['.jpg', '.jpeg', '.png', '.webp', '.avif']) {
      const stale = path.join(IMG_DIR, `product-${rule.id}${e}`);
      if (e !== ext && fs.existsSync(stale)) fs.unlinkSync(stale);
    }

    fs.copyFileSync(src, targetPath);
    product.image = `/images/products/${targetName}`;
    report.manualMapped.push({ file: rule.file, id: rule.id, targetPath: product.image });
  }
}
```

- [ ] **Step 2: Wire into `main`**

Append:

```ts
  applyManualMappings(byId, report);
  console.log(`catalogue-fixes: manual-mapped ${report.manualMapped.length} (skipped ${report.manualSkipped.length})`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `manual-mapped` between 24 and 29 (depending on whether some
files were already mapped via prior scripts), `skipped` is 0 unless some
filenames don't match what's currently in `missing finds/`. If `skipped`
is non-zero, investigate by listing the folder and either fixing the
filename in the rule or noting it.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes manual missing-finds mappings"
```

---

## Task 9: CURENEX explicit variant labels

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add rules + applier**

Above `main()`:

```ts
const CURENEX_LABELS: ReadonlyArray<{ id: number; label: string }> = [
  { id: 215, label: 'SCULP (PLLA)' },
  { id: 216, label: 'PDRN, Multi' },
  { id: 217, label: 'DAILY CARE SKINBOOSTER (SERUM)' },
  { id: 218, label: 'REJUVENATING CREAM' },
  { id: 219, label: 'HYDRATING CLEANSER' },
  { id: 220, label: 'LIPO (FACE AND BODY)' },
  { id: 221, label: 'REJUVENATING MASK' },
  { id: 222, label: 'EXO BRIGHTENING CREAM' },
  { id: 223, label: 'EYE PN' },
  { id: 225, label: 'SNOW PEEL' },
  { id: 226, label: 'SHEER SUNSCREEN' },
];

function applyCurenexLabels(byId: Map<number, Product>, report: Report): void {
  for (const rule of CURENEX_LABELS) {
    const p = byId.get(rule.id);
    if (!p) continue;
    if (p.variantLabel === rule.label) continue;
    p.variantLabel = rule.label;
    report.curenexLabels.push({ id: rule.id, label: rule.label });
  }
}
```

- [ ] **Step 2: Wire into `main`**

Append:

```ts
  applyCurenexLabels(byId, report);
  console.log(`catalogue-fixes: curenex-labels-set ${report.curenexLabels.length}`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: `curenex-labels-set 11` on the first effective run.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalogue-fixes.ts
git commit -m "feat(scripts): catalogue-fixes CURENEX variant labels"
```

---

## Task 10: Final write + report

**Files:**
- Modify: `scripts/catalogue-fixes.ts`

- [ ] **Step 1: Add the report formatter**

Above `main()`:

```ts
function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# catalogue-fixes report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Bundle merges (${r.merged.length})`);
  for (const m of r.merged) lines.push(`  #${m.id}  ${m.from} → ${m.to}`);
  lines.push('');
  lines.push(`## Bundle splits (${r.split.length})`);
  for (const s of r.split) lines.push(`  #${s.id}  cleared from ${s.from}`);
  lines.push('');
  lines.push(`## Image cleared (${r.imageCleared.length})`);
  for (const c of r.imageCleared) lines.push(`  #${c.id}  was=${c.was}`);
  lines.push('');
  lines.push(`## Deleted (${r.deleted.length})`);
  for (const d of r.deleted) lines.push(`  #${d.id}  ${d.name}`);
  lines.push('');
  lines.push(`## Image swaps (${r.swapped.length})`);
  for (const s of r.swapped) lines.push(`  #${s.a} ↔ #${s.b}  ${s.aImage}  /  ${s.bImage}`);
  lines.push('');
  lines.push(`## Manual missing-finds mappings (${r.manualMapped.length})`);
  for (const m of r.manualMapped) lines.push(`  ${m.file}  →  #${m.id}  →  ${m.targetPath}`);
  lines.push('');
  lines.push(`## Manual mappings skipped (${r.manualSkipped.length})`);
  for (const s of r.manualSkipped) lines.push(`  ${s.file}  id=${s.id}  reason=${s.reason}`);
  lines.push('');
  lines.push(`## CURENEX labels (${r.curenexLabels.length})`);
  for (const c of r.curenexLabels) lines.push(`  #${c.id}  ${c.label}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 2: Final write at the end of `main`**

Append:

```ts
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');
  console.log(`catalogue-fixes: wrote ${data.products.length} products`);
  console.log(`catalogue-fixes: report → ${REPORT_PATH}`);
```

- [ ] **Step 3: End-to-end run**

```bash
npx tsx scripts/catalogue-fixes.ts
```

Expected: all the per-step counts plus `wrote 421 products` (was 422 → minus 1 for the deleted CURENEX SCULP 224) and a report file written.

- [ ] **Step 4: Spot-check the data**

```bash
grep -c '"id": 224,' data/products.json    # expect 0
grep -A 14 '"id": 20,' data/products.json | grep groupId    # expect "neuramis"
grep -A 14 '"id": 228,' data/products.json | grep groupId   # expect "dermagen-dermagen"
grep -A 14 '"id": 215,' data/products.json | grep variantLabel    # expect "SCULP (PLLA)"
grep -A 14 '"id": 3,' data/products.json | grep image    # expect "image": ""
grep -A 14 '"id": 67,' data/products.json | grep image    # expect product-67.jpg
head -40 scripts/catalogue-fixes-report.txt
```

- [ ] **Step 5: Commit**

```bash
git add scripts/catalogue-fixes.ts data/products.json scripts/catalogue-fixes-report.txt public/images/products/
git commit -m "feat(scripts): catalogue-fixes write + report"
```

---

## Task 11: Re-run regen-variant-labels

**Files:**
- None modified (running existing script).

- [ ] **Step 1: Run**

```bash
npx tsx scripts/regen-variant-labels.ts
```

Expected: `changed-labels` is small but non-zero (new bundles get labels assigned where possible; the CURENEX labels we already set are detected as already-correct and skipped). `groupImage-filled` may be non-zero (newly merged groups inherit images).

- [ ] **Step 2: Verify CURENEX labels were NOT overwritten**

```bash
grep -A 14 '"id": 218,' data/products.json | grep variantLabel
```

Expected: `"variantLabel": "REJUVENATING CREAM"` (not `"Variant 4"` or similar).

- [ ] **Step 3: Spot-check a new bundle**

```bash
grep -A 14 '"id": 51,' data/products.json | grep -E 'variantLabel|groupId'
```

Expected: `groupId = chaeum`, `variantLabel = "THE CHAEUM PREMIUM #1 (MESO)"` (the spec extraction or the unique-name path will produce something distinguishing).

- [ ] **Step 4: Commit**

```bash
git add data/products.json scripts/regen-variant-labels-report.txt
git commit -m "chore(scripts): regen variant labels after catalogue-fixes"
```

---

## Task 12: Fix duplicate-key bug + tighten Fuse search

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

- [ ] **Step 1: Tighten Fuse options**

Find the `fuseOptions` constant at the top of the file (around lines 15-25). Replace it with:

```tsx
const fuseOptions = {
  threshold: 0.2,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'groupName', weight: 2 },
  ],
};
```

- [ ] **Step 2: Restructure search dual-view**

Inside the `filterResult` useMemo, find the block that builds the search dual-view (currently builds `groupHits` and `individualHits` arrays and returns `{ items: [...groupHits, ...individualHits], bundleIds }`). Replace that block with:

```tsx
    // Search mode: emit one bundle card per matched group, then ALL variants as solo cards.
    // Each render slot is tagged with whether it's the bundle card so the key never collides.
    if (searchQuery.trim()) {
      type Render = { product: Product; asBundle: boolean };
      const renders: Render[] = [];
      const seenGroup = new Set<string>();
      for (const p of result) {
        if (p.groupId) {
          if (!seenGroup.has(p.groupId)) {
            renders.push({ product: p, asBundle: true });
            seenGroup.add(p.groupId);
          }
          renders.push({ product: p, asBundle: false });
        } else {
          renders.push({ product: p, asBundle: false });
        }
      }
      return { renders, isDualView: true };
    }

    const seenGroups = new Set<string>();
    const deduped = result.filter(p => {
      if (!p.groupId) return true;
      if (seenGroups.has(p.groupId)) return false;
      seenGroups.add(p.groupId);
      return true;
    });
    return {
      renders: deduped.map(product => ({ product, asBundle: Boolean(product.groupId) })),
      isDualView: false,
    };
```

Change the type signature of the useMemo to match:

```tsx
  const filterResult = useMemo<{ renders: Array<{ product: Product; asBundle: boolean }>; isDualView: boolean }>(() => {
```

(Adjust the rest of the useMemo body so `result` is still computed inside it — just keep the existing filter/sort logic, then replace the final return shape.)

- [ ] **Step 3: Update render loops**

The component currently destructures `filterResult.items` and `filterResult.bundleIds`. Replace those references with `filterResult.renders` (and remove `bundleIds`).

Find both `paginatedProducts.map(...)` loops (one for `grid`, one for `list`). The current shape is:

```tsx
{paginatedProducts.map(product => {
  const inDualView = bundleIds.size > 0;
  const isBundleCard = bundleIds.has(product.id);
  const vc = inDualView
    ? (isBundleCard && product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1)
    : (product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1);
  return (
    <ProductCard
      key={isBundleCard ? `bundle-${product.groupId}` : `solo-${product.id}`}
      product={product}
      layout="grid"
      variantCount={vc}
      isBundle={isBundleCard}
    />
  );
})}
```

Change `paginatedProducts` to be derived from `filterResult.renders` instead of `filterResult.items`. Above the render loops:

```tsx
  const totalPages = Math.ceil(filterResult.renders.length / PER_PAGE);
  const paginated = filterResult.renders.slice((page - 1) * PER_PAGE, page * PER_PAGE);
```

(Replace the existing `totalPages` and `paginatedProducts` definitions.)

Then each render loop becomes:

```tsx
{paginated.map(r => {
  const vc = r.asBundle && r.product.groupId
    ? (variantCounts.get(r.product.groupId) ?? 1)
    : 1;
  return (
    <ProductCard
      key={r.asBundle ? `bundle-${r.product.groupId}` : `solo-${r.product.id}`}
      product={r.product}
      layout="grid"
      variantCount={vc}
      isBundle={r.asBundle}
    />
  );
})}
```

Same change in the list-layout loop (`layout="list"`).

The `filteredProducts.length` reference (used to display the result count) becomes `filterResult.renders.length`.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors. Fix any inline.

- [ ] **Step 5: Browser verification**

```bash
npm run dev
```

In a browser:
- `/en/catalogue?q=sosum` → exactly: SOSUM bundle card + 5 SOSUM variants (S, M, H, SOFT, HARD). Nothing else.
- Open browser console. No `Encountered two children with the same key` errors.
- `/en/catalogue?q=neuramis` → NEURAMIS bundle + 5 variants. No JUVIDERM, no SOSUM.

- [ ] **Step 6: Commit**

```bash
git add components/catalogue/CatalogueClient.tsx
git commit -m "fix(catalogue): dedupe bundle render keys + tighten Fuse search"
```

---

## Task 13: Save catalogue URL on product click

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`

- [ ] **Step 1: Add the helper**

At the top of the file, after the imports, add:

```tsx
function rememberCatalogueUrl() {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.includes('/catalogue')) return;
  try {
    sessionStorage.setItem('catalogue:lastUrl', window.location.pathname + window.location.search);
  } catch {
    // sessionStorage can throw in private mode — ignore.
  }
}
```

- [ ] **Step 2: Wire onClick on both Link elements**

Find the two `<Link href={`/${locale}/product/${product.id}`} ...>` elements in the file (one in the list-layout branch around line 49, one in the grid-layout branch around line 106). Add `onClick={rememberCatalogueUrl}` to each. Example for the grid one:

```tsx
    <Link
      href={`/${locale}/product/${product.id}`}
      onClick={rememberCatalogueUrl}
      className="product-card group block"
    >
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/catalogue/ProductCard.tsx
git commit -m "feat(catalogue): remember last catalogue URL on product click"
```

---

## Task 14: Back-to-Catalogue uses sessionStorage

**Files:**
- Modify: `components/catalogue/BackToCatalogueButton.tsx`

- [ ] **Step 1: Replace the useEffect body**

Replace the entire `useEffect` block in the component with:

```tsx
  useEffect(() => {
    // Prefer the URL we saved when the user clicked into the product.
    const saved = typeof window !== 'undefined'
      ? sessionStorage.getItem('catalogue:lastUrl')
      : null;

    if (saved) {
      const m = saved.match(/^\/[^/]+\/catalogue(?:\/([^/]+))?/);
      const categoryId = m && m[1];
      const categoryName = categoryId ? categoriesById[categoryId] : undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTarget({
        href: saved,
        label: categoryName ? `Back to ${categoryName}` : 'Back to Catalogue',
      });
      return;
    }

    // Fallback: try document.referrer (covers arrivals from outside the app).
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    if (!referrer) return;
    let url: URL;
    try { url = new URL(referrer); } catch { return; }
    if (url.origin !== window.location.origin) return;
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

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors.

- [ ] **Step 3: Browser verification**

```bash
npm run dev
```

In a browser:
- Visit `/en/catalogue?q=regenovue` → click any product → click *Back to Catalogue* → land on `/en/catalogue?q=regenovue`.
- Visit `/en/catalogue?cat=fillers&page=3` → click any product → *Back to ...* → land on page 3 with `cat=fillers`. The label reads `Back to Fillers`.
- Open `/en/product/<id>` directly (paste URL into browser) → *Back to Catalogue* → land on `/en/catalogue` (fallback, since sessionStorage is empty).

- [ ] **Step 4: Commit**

```bash
git add components/catalogue/BackToCatalogueButton.tsx
git commit -m "feat(catalogue): back button reads sessionStorage first"
```

---

## Task 15: End-to-end manual verification

**Files:**
- None modified.

- [ ] **Step 1: Start dev server (if not already running)**

```bash
npm run dev
```

- [ ] **Step 2: Bundle merges**

- `/en/catalogue?cat=dermagen` → 227-245 render as a single bundle card. 228, 229, 230, 231 do not appear as standalone cards.
- Click the dermagen bundle → product detail → variant dropdown lists 19 variants including Dr. Picos and Cindelria.

- [ ] **Step 3: NEURAMIS + CURENEX + others**

- `/en/catalogue?q=neuramis` → bundle card + 5 variants (NEURAMIS LIGHT, NEURAMIS, NEURAMIS DEEP, NEURAMIS DEEP WITH LIDOCAINE, NEURAMIS VOLUME LIDOCAINE). No JUVIDERM/RESTYLANE pollution.
- `/en/catalogue?q=curenex` → bundle card + 11 variants (215, 216, 217, 218, 219, 220, 221, 222, 223, 225, 226). No 224. Variant dropdown on the product detail page shows the explicit labels (`SCULP (PLLA)`, `PDRN, Multi`, …).
- `/en/catalogue?q=sosum` → bundle + 5 SOSUM variants. No unrelated products.

- [ ] **Step 4: Image fixes**

- `/en/product/3`, `/en/product/4`, `/en/product/17`, `/en/product/84`, `/en/product/216`, `/en/product/348`, `/en/product/349`, `/en/product/387`, `/en/product/408`, `/en/product/409`, `/en/product/410`, `/en/product/411` → all show the placeholder (no wrong-product image).
- `/en/product/67` (AdiMis), `/en/product/69` (MAXY FILL), `/en/product/84` is now blank because cleared, but the manual mapping at id 84 will re-set the image to the ULTRAGEN_X file. Verify `/en/product/84` shows the ULTRAGEN image, not blank.
- `/en/product/218` shows the CURENEX REJUVENATING CREAM file.

- [ ] **Step 5: Swap pairs**

- `/en/product/21` and `/en/product/22` (NEURAMIS / NEURAMIS DEEP) show the swapped images.
- `/en/product/66` and `/en/product/103` show swapped images.
- `/en/product/119` and `/en/product/121` show swapped images.

- [ ] **Step 6: Back button + state**

- `/en/catalogue?q=regenovue&page=2` → click a product → *Back* → URL is `/en/catalogue?q=regenovue&page=2`.
- Console: no `duplicate key` errors during navigation or scrolling.

- [ ] **Step 7: Sidebar count**

- Sidebar "All Categories" shows `421` (was 422 → minus 1 deleted CURENEX SCULP 224).

- [ ] **Step 8: If anything fails**

Restore from `data/backups/products-{stamp}.json` and re-run from Task 10. The UI patches (Tasks 12-14) can be reverted individually with `git revert <sha>`.

- [ ] **Step 9: Final commit only if verification surfaced a fix**

```bash
git add <changed-files>
git commit -m "fix: address verification finding in <area>"
```

If nothing changed, skip.

---

## Out of scope (follow-up tickets)

- id 141 DERMAHEAL SR price discovery.
- REJUBEAU MESO NEEDLE 408-411 color images (user to provide yellow / green / black / orange).
- 417/418 Sungshim image disambiguation.
- Remaining `missing finds/` files (BEADS, DN16, Dermaheal-HL, ETREBELLE, Lipo-Shrinker, restylane-lyft, misadi-h, misfill pdrn, p198-exonature, WILLCAM, autodn_mts, Vita-D 200u, lipolabgms, ULTRATONING) — user to confirm IDs.
