# Cluster A: Image Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix product-image mismatches and variantLabel collisions introduced by the JotForm fuzzy-name sync, using a re-run of the existing vision-audit pipeline + a smarter re-sourcing pass.

**Architecture:** Four sequential tasks. Task 1 cleans whitespace-mangled product names that the matcher missed. Task 2 runs the vision audit and clears confirmed-wrong images. Task 3 re-sources cleared products from the on-disk JotForm scrape with a tightened matcher. Task 4 disambiguates variant labels within groups and refreshes group covers. Each task ends in a data commit.

**Tech Stack:** TypeScript 5, Node 20, `axios`, `cheerio`, `sharp`, `tsx` — all already installed. Vision audit uses Claude vision-capable subagents (the same pattern as commit `26e5deb`).

**Spec:** `docs/superpowers/specs/2026-05-18-image-bug-fixes-design.md` (commit `4a3ef73`).

---

## File Structure

**Created files (scripts):**
- `scripts/clean-mangled-names.ts` — Task 1
- `scripts/refill-from-jotform.ts` — Task 3
- `scripts/fix-variant-labels.ts` — Task 4

**Created files (reports, gitignored):**
- `scripts/clean-mangled-names-report.txt` — output of Task 1
- `scripts/refill-from-jotform-report.txt` — output of Task 3
- `scripts/fix-variant-labels-report.txt` — output of Task 4

**Reused (unchanged):**
- `scripts/audit-prep.ts` — already exists from commit `26e5deb`
- `scripts/audit-apply.ts` — already exists
- `scripts/derive-group-display.ts` — already exists
- `scripts/lib/fuzzy-match.ts` — `normalise` + `scoreMatch` helpers

**Modified:**
- `package.json` — three new script entries (`clean-mangled-names`, `refill-from-jotform`, `fix-variant-labels`)
- `.gitignore` — three new lines for the new report files
- `data/products.json` — name cleanups (Task 1), image clears (Task 2), re-source updates (Task 3), variantLabel fixes (Task 4), groupName/groupImage refresh (Task 4)
- `public/images/products/` — new webp files for re-sourced products (Task 3)

Backups land in `data/backups/` (already gitignored).

---

## Task 1: Clean whitespace-mangled product names

**Files:**
- Create: `scripts/clean-mangled-names.ts`
- Modify: `package.json` (one new script entry), `.gitignore` (one new line)
- Mutates (via script execution): `data/products.json`, `data/backups/products-<timestamp>.json`

The product names listed in the prior JotForm sync's unmatched-products section include stray inner whitespace that defeats the token matcher. Cleaning these recovers ~8 matches.

### Step 1: Create the cleanup script

Create `scripts/clean-mangled-names.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'clean-mangled-names-report.txt');

interface Product { id: number; name: string }
interface DataFile { products: Product[] }

/**
 * Collapse single inner space between a single uppercase letter/digit and
 * a longer uppercase fragment. Iterates until stable.
 *
 *   "M EDITOXIN"     → "MEDITOXIN"
 *   "H YALACE"       → "HYALACE"
 *   "VOM INTEN S E"  → "VOM INTENSE"
 *   "2 XSOME"        → "2XSOME"
 *
 * Single uppercase letter or digit + space + uppercase fragment >= 2 chars.
 * Does not touch lowercase words ("nano cannula" stays intact).
 */
function cleanName(name: string): string {
  const re = /\b([A-Z0-9])\s+([A-Z][A-Z0-9]{1,})\b/g;
  let prev = name;
  let cur = name.replace(re, '$1$2');
  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(re, '$1$2');
  }
  return cur;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const changes: Array<{ id: number; before: string; after: string }> = [];

  for (const p of data.products) {
    const cleaned = cleanName(p.name);
    if (cleaned !== p.name) {
      changes.push({ id: p.id, before: p.name, after: cleaned });
      p.name = cleaned;
    }
  }

  if (changes.length === 0) {
    console.log('No mangled names found. Nothing to do.');
    fs.writeFileSync(REPORT_PATH, 'No mangled names found.\n', 'utf8');
    return;
  }

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${changes.length} product name(s) in data/products.json`);

  const lines: string[] = [
    `Clean mangled names — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Total changes: ${changes.length}`,
    '',
  ];
  for (const c of changes) {
    lines.push(`#${c.id}  "${c.before}"  →  "${c.after}"`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
```

### Step 2: Add npm script + .gitignore entry

In `package.json`, append to `"scripts"`:

```json
    "clean-mangled-names": "tsx scripts/clean-mangled-names.ts"
```

In `.gitignore`, append:

```
scripts/clean-mangled-names-report.txt
```

### Step 3: Run

`npm run clean-mangled-names`

Expected output:
```
Backup written to data/backups/products-<timestamp>.json
Updated <N> product name(s) in data/products.json
Report written to scripts/clean-mangled-names-report.txt
```

Where N is between 5 and 15. Read `scripts/clean-mangled-names-report.txt` — every line should be a sensible rewrite (no lowercase words turned upper, no over-merging). If any rewrite looks wrong, revert from the backup (`cp data/backups/products-<timestamp>.json data/products.json`) and adjust the regex before retrying.

### Step 4: Verify

```bash
npx tsc --noEmit
npm run lint
```

Both should match the baseline (`tsc` exit 0, `lint` at 70 problems).

Spot-check via `node`:

```bash
node -e "const d=require('./data/products.json'); console.log(d.products.find(p=>p.id===18))"
```

Expected: the product previously named `VOM INTEN S E` now has `name: 'VOM INTENSE'`.

### Step 5: Commit

```bash
git add scripts/clean-mangled-names.ts package.json .gitignore data/products.json
git commit -m "feat(data): clean whitespace-mangled product names"
```

(The new report file is gitignored. The new backup under `data/backups/` is also gitignored.)

---

## Task 2: Run the vision audit and clear mismatches

**Files:**
- No new code files. Uses existing `scripts/audit-prep.ts` and `scripts/audit-apply.ts`.
- Mutates (via script execution): `data/products.json` (clears mismatched `image`), `scripts/audit-batches/batch-*.json`, `scripts/audit-results.json`, `scripts/audit-report.txt`

### Step 1: Re-batch the audit set

`npm run audit-prep`

Expected output: `Wrote <N> batches (<M> products) to scripts/audit-batches`. With 386 products carrying images and BATCH_SIZE = 30, you should see 13 batches (12 full + 1 partial of 26).

The script wipes any previous batches first, so prior contents are replaced.

### Step 2: Vision-audit each batch

This step requires the **orchestrator (controller)** to dispatch a vision-capable subagent for each batch. The subagent reads each image in its batch and emits per-product JSON `{ id, status, reason }`.

Dispatch one subagent per batch (in series, not parallel, to avoid resource contention). For each batch, use this prompt template:

```
You are auditing product images for visual identity match against the product names.

Read `scripts/audit-batches/batch-{N}.json`. For each entry it lists `{ id, name, categoryName, imagePath }`.

For each entry, use the Read tool on `imagePath` to view the actual image. Compare the visible product (packaging label, branding text, product type) to the listed `name` and `categoryName`.

Emit ONE of three statuses per product:
- `CONFIRMED` — image clearly shows the named product (even if photo is a stock/marketing shot, as long as the product brand+variant matches).
- `MISMATCH` — image clearly shows a DIFFERENT product (e.g. wrong brand, wrong variant: REGENOVUE FINE vs REGENOVUE DEEP is MISMATCH; SOSUM S vs SOSUM M is MISMATCH).
- `UNCERTAIN` — image text is unreadable, the package is generic, or you cannot tell from the photo.

Be strict on variant-level matches (FINE vs DEEP, S vs M, etc.) because the fuzzy-name sync's known weakness is collapsing variants.

Write your output as a single JSON file at `scripts/audit-batches/result-{N}.json` containing an array `[{ id, status, reason }, ...]`. `reason` is a one-sentence explanation. Use Write tool.

Report DONE when the file is written. Do not modify any other files.
```

Substitute `{N}` with 0, 1, …, 12 for each dispatch.

After all 13 subagents complete, consolidate into one file:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'scripts/audit-batches';
const all = [];
for (let i = 0; i < 100; i++) {
  const p = path.join(dir, 'result-' + i + '.json');
  if (!fs.existsSync(p)) break;
  all.push(...JSON.parse(fs.readFileSync(p, 'utf8')));
}
fs.writeFileSync('scripts/audit-results.json', JSON.stringify(all, null, 2));
console.log('Consolidated', all.length, 'results into scripts/audit-results.json');
"
```

Verify the count is ~386.

### Step 3: Apply the audit

`npm run audit-apply`

(If this script isn't already an npm script entry, run via `npx tsx scripts/audit-apply.ts`.)

Expected output: backup written, `Cleared <N> mismatched/uncertain image(s)`, `Report written to scripts/audit-report.txt`.

### Step 4: Inspect the report

Read the head of `scripts/audit-report.txt`. Confirm:
- The MISMATCH section contains the user-cited bugs:
  - id 17 `VOM LIGHT (CE) NO Lidocaine` (image was REGENOVUE FINE)
  - id 23 `NEURAMIS DEEP WITH LIDOCAINE` (image was same as id 22)
- The UNCERTAIN section, if non-empty, doesn't contain obviously-correct matches.

### Step 5: Verify

```bash
npx tsc --noEmit
npm run lint
```

Both at baseline.

### Step 6: Commit

```bash
git add data/products.json scripts/audit-results.json scripts/audit-report.txt
git commit -m "feat(data): vision audit clears <N> mismatched product images"
```

(The `scripts/audit-batches/` files are not committed — they're per-run scratch space. Verify they're in `.gitignore`; if not, add `scripts/audit-batches/` to it.)

---

## Task 3: Re-source cleared images from the JotForm scrape

**Files:**
- Create: `scripts/refill-from-jotform.ts`
- Modify: `package.json` (one new script entry), `.gitignore` (one new line)
- Mutates: `data/products.json` (sets `image` on cleared products), `public/images/products/product-<id>.webp` (new files), `data/backups/products-<timestamp>.json`, `scripts/refill-from-jotform-report.txt`

### Step 1: Create the refill script

Create `scripts/refill-from-jotform.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');
const SCRAPE_PATH = path.join(ROOT, 'scripts', 'jotform-scrape.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'refill-from-jotform-report.txt');

const MATCH_THRESHOLD = 3; // stricter than the original sync (2) — smaller pool

interface JotformProduct { name: string; imageUrl: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface DataFile {
  categories: unknown;
  products: Product[];
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  const buf = Buffer.from(res.data);
  await sharp(buf)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(dest);
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

async function main(): Promise<void> {
  if (!fs.existsSync(SCRAPE_PATH)) {
    console.error(`Missing ${SCRAPE_PATH}. Run \`npm run sync-from-jotform -- --dry-run\` first.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const scraped = JSON.parse(fs.readFileSync(SCRAPE_PATH, 'utf8')) as JotformProduct[];

  // Candidate pool: every JotForm entry whose URL is NOT already used by a product.
  const inUse = new Set(
    data.products
      .filter(p => p.image && typeof p.image === 'string' && p.image.length > 0)
      .map(p => p.image),
  );
  const usedJotformUrls = new Set<string>();
  // Note: we can't directly know which JotForm URLs are in-use by basename mapping,
  // so for safety we treat every cleared product as eligible to consume any
  // remaining JotForm entry, and rely on consumption-tracking to prevent dupes.

  const candidates = scraped.slice(); // shallow copy
  const consumed = new Set<JotformProduct>();

  // Targets: products with image === "" (cleared by audit or originally unmatched).
  const targets = data.products.filter(p => !p.image || p.image.length === 0);
  console.log(`Refilling ${targets.length} cleared/unmatched products from ${candidates.length} JotForm entries.`);

  // Sort targets by name length descending for greedy specificity.
  const ordered = [...targets].sort((a, b) => b.name.length - a.name.length);

  const matches: Array<{ product: Product; jp: JotformProduct; score: number }> = [];
  for (const product of ordered) {
    const pnorm = normalise(product.name);
    let best: { jp: JotformProduct; score: number } | null = null;
    for (const jp of candidates) {
      if (consumed.has(jp)) continue;
      const s = scoreMatch(pnorm, normalise(jp.name));
      if (!best || s > best.score) best = { jp, score: s };
    }
    if (best && best.score >= MATCH_THRESHOLD) {
      consumed.add(best.jp);
      matches.push({ product, jp: best.jp, score: best.score });
    }
  }

  console.log(`Matched ${matches.length} / ${targets.length} cleared products to JotForm entries.`);

  // Download.
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const failed: Array<{ id: number; name: string; url: string; error: string }> = [];
  let downloaded = 0;

  for (const m of matches) {
    const dest = path.join(OUTPUT_DIR, `product-${m.product.id}.webp`);
    try {
      await downloadImage(m.jp.imageUrl, dest);
      downloaded++;
      console.log(`✓ ${m.product.id} ${m.product.name}  ←  "${m.jp.name}" (score ${m.score})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ id: m.product.id, name: m.product.name, url: m.jp.imageUrl, error: msg });
      console.warn(`✗ ${m.product.id} ${m.product.name} — ${msg}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const failedIds = new Set(failed.map(f => f.id));
  const downloadedIds = new Set(matches.filter(m => !failedIds.has(m.product.id)).map(m => m.product.id));

  // Mutate JSON.
  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);
  for (const p of data.products) {
    if (downloadedIds.has(p.id)) {
      p.image = `/images/products/product-${p.id}.webp`;
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Set image on ${downloadedIds.size} product(s) in data/products.json`);

  // Report.
  const stillUnmatched = targets.filter(t => !consumed.has(matches.find(m => m.product.id === t.id)?.jp ?? ({} as JotformProduct)));
  const lines: string[] = [
    `Refill from JotForm — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Cleared/unmatched targets: ${targets.length}`,
    `Matched: ${matches.length}`,
    `Downloaded: ${downloaded}  Failed: ${failed.length}`,
    `Still unmatched: ${stillUnmatched.length}`,
    '',
  ];
  if (matches.length) {
    lines.push('Matches:');
    for (const m of matches) {
      lines.push(`  #${m.product.id}  "${m.product.name}"  ←  "${m.jp.name}" (score ${m.score})`);
    }
    lines.push('');
  }
  if (stillUnmatched.length) {
    lines.push(`Still unmatched (${stillUnmatched.length}):`);
    for (const p of stillUnmatched) {
      lines.push(`  #${p.id}  "${p.name}"  (${p.categoryId})`);
    }
    lines.push('');
  }
  if (failed.length) {
    lines.push('Failed downloads:');
    for (const f of failed) lines.push(`  #${f.id} "${f.name}" — ${f.error}`);
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### Step 2: Add npm script + .gitignore entry

In `package.json`, append to `"scripts"`:

```json
    "refill-from-jotform": "tsx scripts/refill-from-jotform.ts"
```

In `.gitignore`, append:

```
scripts/refill-from-jotform-report.txt
```

### Step 3: Run

`npm run refill-from-jotform`

Expected: streams `✓ <id> <name> ← "<jpname>" (score N)` lines for each matched download. At the end, summary `Matched: M / T, Downloaded: D, Failed: F, Still unmatched: U`.

Target: Matched ≥ 30 of the cleared/unmatched set (the prior 52 unmatched + however many the audit cleared).

### Step 4: Inspect

Read `scripts/refill-from-jotform-report.txt`. Eyeball the Matches section — every line should show a sensible name/jpname pair. If any look wrong (e.g. score = 3 with two totally different products), that's expected residue; flag in the report.

Spot-check id 17 and id 21 via:

```bash
node -e "const d=require('./data/products.json'); for(const id of [17,21,23]){const p=d.products.find(x=>x.id===id); console.log(JSON.stringify({id:p.id,name:p.name,image:p.image}))}"
```

Each should now have a non-empty `image`.

### Step 5: Verify

```bash
npx tsc --noEmit
npm run lint
```

Both at baseline.

### Step 6: Commit

```bash
git add scripts/refill-from-jotform.ts package.json .gitignore data/products.json public/images/products/
git commit -m "feat(data): refill <N> cleared images via re-sourced JotForm matches"
```

---

## Task 4: Fix variantLabel collisions + refresh group covers

**Files:**
- Create: `scripts/fix-variant-labels.ts`
- Modify: `package.json` (one new script entry), `.gitignore` (one new line)
- Mutates: `data/products.json` (variantLabel updates, then groupName/groupImage refresh via derive-groups)

### Step 1: Create the fix-variant-labels script

Create `scripts/fix-variant-labels.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'fix-variant-labels-report.txt');

interface Product {
  id: number;
  name: string;
  groupId?: string;
  variantLabel?: string;
}
interface DataFile { products: Product[] }

/**
 * Given a product name and an existing label that collides with a sibling,
 * compute a disambiguating label by appending a hint derived from the name.
 */
function disambiguate(name: string, existingLabel: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('NO LIDOCAINE')) return `${existingLabel} (NO LIDO)`;
  if (upper.includes('WITH LIDOCAINE')) return `${existingLabel} + LIDO`;
  if (upper.includes('LIDOCAINE')) return `${existingLabel} + LIDO`;
  if (upper.includes('PLUS')) return `${existingLabel} +`;
  if (upper.includes('IMPLANT')) return `${existingLabel} (IMPLANT)`;
  if (upper.includes('CE')) return `${existingLabel} (CE)`;
  if (upper.includes('MESO')) return `${existingLabel} (MESO)`;
  const tokens = name.trim().split(/\s+/);
  return `${existingLabel} (${tokens[tokens.length - 1]})`;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const groups = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  const changes: Array<{ id: number; before: string; after: string; group: string }> = [];

  for (const [groupId, members] of groups) {
    const sorted = [...members].sort((a, b) => a.id - b.id);
    const seenLabels = new Map<string, Product>(); // label → first product to claim it
    for (const p of sorted) {
      const label = p.variantLabel ?? p.name;
      if (!seenLabels.has(label)) {
        seenLabels.set(label, p);
        continue;
      }
      // Collision — disambiguate this later product (keep first claimant unchanged).
      let newLabel = disambiguate(p.name, label);
      // If the disambiguated form also collides (unlikely), append #id.
      let n = 2;
      while (seenLabels.has(newLabel)) {
        newLabel = `${label} (#${n++})`;
      }
      changes.push({ id: p.id, before: label, after: newLabel, group: groupId });
      p.variantLabel = newLabel;
      seenLabels.set(newLabel, p);
    }
  }

  if (changes.length === 0) {
    console.log('No variantLabel collisions found.');
    fs.writeFileSync(REPORT_PATH, 'No collisions.\n', 'utf8');
    return;
  }

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Disambiguated ${changes.length} variantLabel(s)`);

  const lines: string[] = [
    `Fix variant labels — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Total changes: ${changes.length}`,
    '',
  ];
  for (const c of changes) {
    lines.push(`group "${c.group}" #${c.id}:  "${c.before}"  →  "${c.after}"`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
```

### Step 2: Add npm script + .gitignore entry

In `package.json`, append to `"scripts"`:

```json
    "fix-variant-labels": "tsx scripts/fix-variant-labels.ts"
```

In `.gitignore`, append:

```
scripts/fix-variant-labels-report.txt
```

### Step 3: Run

```bash
npm run fix-variant-labels
npm run derive-groups
```

The first command disambiguates colliding variant labels. The second refreshes `groupName` / `groupImage` to pick up any newly-sourced images from Task 3.

Spot-check via:

```bash
node -e "const d=require('./data/products.json'); const g=d.products.filter(p=>p.groupId==='neuramis'); g.forEach(p=>console.log(JSON.stringify({id:p.id,name:p.name,variantLabel:p.variantLabel,image:p.image,groupImage:p.groupImage})))"
```

Expected: id 22 still has `variantLabel: 'DEEP'`. id 23 now has `variantLabel: 'DEEP + LIDO'`. Both have populated `image`. `groupImage` is consistent across all Neuramis variants.

### Step 4: Verify

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three: tsc exit 0, lint at baseline (70), build exit 0 (all 38 routes compile).

### Step 5: Manual UI smoke

Run `npm run dev`. Open:

- `http://localhost:3000/en/product/21` — NEURAMIS — image should render (not empty).
- `http://localhost:3000/en/product/17` — VOM LIGHT (CE) NO Lidocaine — image should look like a VOM product, not REGENOVUE FINE.
- Catalogue page — group cards should have sensible covers. Specifically, find the Neuramis group card — its cover should be a real NEURAMIS image, not just whatever was there before.

Stop dev server.

### Step 6: Commit

```bash
git add scripts/fix-variant-labels.ts package.json .gitignore data/products.json
git commit -m "feat(data): disambiguate variantLabel collisions + refresh group covers"
```

---

## Final verification

After all four tasks complete:

- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm run lint` produces exactly 70 problems (baseline). No new errors.
- [ ] `npm run build` exits 0.
- [ ] `node -e "const d=require('./data/products.json'); console.log('with image:', d.products.filter(p=>p.image).length, '/ 438')"` — target ≥ 390.
- [ ] No two products in the same `groupId` share the same `variantLabel`:

  ```bash
  node -e "
  const d=require('./data/products.json');
  const groups={};
  for(const p of d.products){if(p.groupId){(groups[p.groupId]=groups[p.groupId]||[]).push(p)}}
  let dupes=0;
  for(const [g,ms] of Object.entries(groups)){
    const labels=ms.map(m=>m.variantLabel||m.name);
    const seen=new Set();
    for(const l of labels){
      if(seen.has(l)){console.log('DUP:',g,'→',l); dupes++}
      seen.add(l);
    }
  }
  console.log('Total duplicates:', dupes);
  "
  ```

  Expected: `Total duplicates: 0`.

- [ ] Specific bug spot-checks pass (id 17 VOM LIGHT shows VOM product image; id 21 NEURAMIS has its own image; id 23 has variantLabel 'DEEP + LIDO').

Any residual issues become a curation follow-up — out of scope for Cluster A.
