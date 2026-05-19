# Brand + UI + Bundle Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five focused fixes: shorten all category-template protocols to one sentence, generate composite bundle cover images, rename Lumière → Lumée Maison, show both card and total product counts in catalogue, and slightly enlarge catalogue text + soften corners.

**Architecture:** Two new Node scripts (`scripts/shorten-protocols.ts`, `scripts/compose-bundle-covers.ts`) plus targeted edits to UI components and i18n message files.

**Tech Stack:** TypeScript via `tsx`, `sharp` (already a dependency), Tailwind class swaps.

**Spec:** `docs/superpowers/specs/2026-05-19-brand-ui-bundles-design.md`

---

## Task 1: `scripts/shorten-protocols.ts` + run

**Files:** Create `scripts/shorten-protocols.ts`, modify `package.json`, modify `data/products.json` (via script).

- [ ] **Step 1**: Add npm alias. In `package.json` `scripts`, after `apply-protocol-templates`, add:

```json
    "shorten-protocols": "tsx scripts/shorten-protocols.ts",
    "compose-bundle-covers": "tsx scripts/compose-bundle-covers.ts",
```

Verify: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` — no output.

- [ ] **Step 2**: Create `scripts/shorten-protocols.ts` with this exact content:

```ts
/**
 * Replace verbose category-template protocols with 1-sentence equivalents.
 * Preserves Jotform-derived protocols (those not matching the long template
 * leading phrases).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'shorten-protocols-report.txt');

interface Product {
  id: number;
  name: string;
  categoryId: string;
  protocol?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: Array<{ id: string }> }

const SHORT_TEMPLATES: Record<string, string> = {
  'fillers': 'Inject at the indicated dermal depth using a 27-30G needle; aspirate before each bolus.',
  'mesotherapy': 'Inject intradermally at 1-4 mm depth using a 30G needle; cycle weekly for 4-8 sessions.',
  'acne-treatment': 'Apply a thin layer to clean, dry skin 1-2× daily; pair with broad-spectrum SPF 30+.',
  'hair-treatment': 'Apply or inject at the scalp at 2-3 mm depth; cycle weekly for 4-6 sessions.',
  'pharmacy-favourites': 'Use per product label and prescriber direction; observe storage and expiration.',
  'topical-cosmetics': 'Apply a thin layer to clean, dry skin morning and/or evening; pair AM with SPF 30+.',
  'intimate-care': 'Apply a small amount externally to the V-zone 1-2× daily; avoid mucosal surfaces.',
  'growth-factor-exosome': 'Reconstitute with the supplied diluent; apply via microneedling or 30G mesotherapy.',
  'curenex': 'Use per the Curenex product type; injectables go intradermally at 1-2 mm with a 30G needle.',
  'dermagen': 'Apply a thin layer to clean, dry skin 1-2× daily; pair AM with broad-spectrum SPF 30+.',
  'gtm': 'Apply per product type; in-clinic peels follow neutralization per the manufacturer protocol.',
  'equipment': 'Reserved for trained operators; calibrate, configure per indication, treat in even passes.',
  'salon-grade': 'Professional spa use; apply per product type and rinse or remove per the protocol.',
  'lipolytics': 'Inject subcutaneously into the fat compartment at 6-13 mm depth using a 27-30G needle.',
  'botulinum': "Reconstitute with 0.9% saline; inject 0.1 mL per point using a 30-32G needle.",
  'injections': 'Restricted to licensed practitioners; administer per package insert with a 27-30G needle.',
  'anesthetics': 'Apply a thick layer under occlusion for 20-60 min; remove and start the procedure immediately.',
  'placental-therapy': 'Administer intramuscularly or via subcutaneous mesotherapy 2-3× weekly for 4-8 weeks.',
  'nano-needle-cannula': 'Sterile single-patient use; insert at the planned depth and deliver the product slowly.',
  'imported-products': "Follow the manufacturer's insert and applicable local regulations for the imported brand.",
};

// Long-template leading phrases. A protocol matching any of these is a long
// template applied by apply-protocol-templates.ts and is safe to overwrite.
const LONG_TEMPLATE_LEADS: ReadonlyArray<RegExp> = [
  /^Restricted to licensed practitioners trained in injectable techniques/i,
  /^Cleanse and disinfect the treatment area/i,
  /^Apply to clean, dry skin once or twice daily/i,
  /^For topical formulations: apply to clean, dry scalp/i,
  /^Use per product label and prescriber direction/i,
  /^Apply to clean, dry skin morning and \/ or evening/i,
  /^Intended for external V-zone application/i,
  /^Reconstitute the lyophilized powder with the supplied diluent/i,
  /^Use as part of the Curenex/i,
  /^Topical formulations: apply a thin layer to clean, dry skin in the targeted area/i,
  /^Apply per GTM product type/i,
  /^Reserved for trained operators/i,
  /^Professional spa or salon use/i,
  /^Restricted to licensed practitioners\.\s*Pre-treatment: medical history review/i,
  /^Reconstitute the lyophilized powder with 0\.9% saline/i,
  /^Restricted to licensed practitioners\.\s*Reconstitute \(if applicable\)/i,
  /^Topical surface anesthetic\./i,
  /^Restricted to licensed practitioners\.\s*Reconstitute as supplied/i,
  /^Sterile single-patient use\./i,
  /^Restricted to licensed practitioners\.\s*Follow the manufacturer/i,
];

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function isLongTemplate(s: string | undefined): boolean {
  if (!s) return false;
  return LONG_TEMPLATE_LEADS.some(re => re.test(s));
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`shorten-protocols: backup -> ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const applied: Array<{ id: number; name: string; categoryId: string }> = [];
  const skipped: Array<{ id: number; name: string; reason: string }> = [];

  for (const p of data.products) {
    const target = SHORT_TEMPLATES[p.categoryId];
    if (!target) {
      skipped.push({ id: p.id, name: p.name, reason: `no short template for ${p.categoryId}` });
      continue;
    }
    if (p.protocol === target) continue;
    if (!isLongTemplate(p.protocol)) {
      skipped.push({ id: p.id, name: p.name, reason: 'preserve (not long template)' });
      continue;
    }
    p.protocol = target;
    applied.push({ id: p.id, name: p.name, categoryId: p.categoryId });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# shorten-protocols report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`applied: ${applied.length}  skipped: ${skipped.length}`);
  lines.push('');
  lines.push(`## Applied (${applied.length})`);
  for (const a of applied) lines.push(`  #${a.id}  [${a.categoryId}]  ${a.name}`);
  lines.push('');
  lines.push(`## Skipped (${skipped.length})`);
  for (const s of skipped) lines.push(`  #${s.id}  ${s.name}  --  ${s.reason}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`shorten-protocols: applied=${applied.length} skipped=${skipped.length}`);
  console.log(`shorten-protocols: report -> ${REPORT_PATH}`);
}

main();
```

- [ ] **Step 3**: Run: `npx tsx scripts/shorten-protocols.ts`. Expected: applied≈300-310, skipped≈110-120. Spot-check id 1: `grep -A 22 '"id": 1,' data/products.json | grep protocol`.

- [ ] **Step 4**: Commit:

```bash
git add package.json scripts/shorten-protocols.ts data/products.json scripts/shorten-protocols-report.txt
git commit -m "feat(scripts): shorten category-template protocols to 1 sentence"
```

---

## Task 2: `scripts/compose-bundle-covers.ts` + run

**Files:** Create `scripts/compose-bundle-covers.ts`, modify `data/products.json` (via script), create `public/images/bundles/`.

- [ ] **Step 1**: Create the script with this content:

```ts
/**
 * Compose 800x800 webp bundle cover images from variant product images.
 * Updates each member's groupImage to the new bundle file.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const PRODUCTS_IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const BUNDLES_IMG_DIR = path.join(ROOT, 'public', 'images', 'bundles');
const PLACEHOLDER = path.join(BUNDLES_IMG_DIR, '_placeholder.webp');
const REPORT_PATH = path.join(ROOT, 'scripts', 'compose-bundle-covers-report.txt');

const CANVAS = 800;

interface Product {
  id: number;
  name: string;
  groupId?: string;
  image: string;
  groupImage?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function gridFor(n: number): { rows: number; cols: number; take: number } {
  if (n <= 1) return { rows: 1, cols: 1, take: 1 };
  if (n === 2) return { rows: 1, cols: 2, take: 2 };
  if (n <= 4) return { rows: 2, cols: 2, take: n };
  if (n <= 6) return { rows: 2, cols: 3, take: n };
  return { rows: 3, cols: 3, take: 9 };
}

async function ensurePlaceholder(): Promise<void> {
  if (fs.existsSync(PLACEHOLDER)) return;
  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: '#e5e5e5' },
  })
    .webp({ quality: 80 })
    .toFile(PLACEHOLDER);
}

async function buildCover(groupId: string, members: Product[]): Promise<{ outputPath: string; usedPlaceholders: number }> {
  const { rows, cols, take } = gridFor(members.length);
  const cellW = Math.floor(CANVAS / cols);
  const cellH = Math.floor(CANVAS / rows);

  const composites: sharp.OverlayOptions[] = [];
  let usedPlaceholders = 0;

  for (let i = 0; i < take; i++) {
    const m = members[i];
    let srcAbs: string;
    if (m.image && m.image.startsWith('/images/products/')) {
      srcAbs = path.join(ROOT, 'public', m.image);
    } else {
      srcAbs = PLACEHOLDER;
    }
    if (!fs.existsSync(srcAbs) || fs.statSync(srcAbs).size === 0) {
      srcAbs = PLACEHOLDER;
      usedPlaceholders++;
    }

    const cellBuf = await sharp(srcAbs)
      .resize(cellW, cellH, { fit: 'inside', background: '#ffffff' })
      .extend({
        top: 0, bottom: 0, left: 0, right: 0,
        background: '#ffffff',
      })
      .resize(cellW, cellH, { fit: 'contain', background: '#ffffff' })
      .toBuffer();

    const left = (i % cols) * cellW;
    const top = Math.floor(i / cols) * cellH;
    composites.push({ input: cellBuf, left, top });
  }

  const outputName = `bundle-${groupId}.webp`;
  const outputPath = path.join(BUNDLES_IMG_DIR, outputName);

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite(composites)
    .webp({ quality: 85 })
    .toFile(outputPath);

  return { outputPath: `/images/bundles/${outputName}`, usedPlaceholders };
}

async function main(): Promise<void> {
  const backupPath = backupDataFile();
  console.log(`compose-bundle-covers: backup -> ${backupPath}`);

  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await ensurePlaceholder();

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }

  const composed: Array<{ groupId: string; members: number; output: string; usedPlaceholders: number }> = [];
  const skipped: Array<{ groupId: string; reason: string }> = [];
  const errors: Array<{ groupId: string; error: string }> = [];

  for (const [groupId, members] of byGroup) {
    if (members.length < 2) {
      skipped.push({ groupId, reason: `only ${members.length} member(s)` });
      continue;
    }
    try {
      const { outputPath, usedPlaceholders } = await buildCover(groupId, members);
      for (const m of members) m.groupImage = outputPath;
      composed.push({ groupId, members: members.length, output: outputPath, usedPlaceholders });
    } catch (err) {
      errors.push({ groupId, error: (err as Error).message });
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# compose-bundle-covers report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`composed: ${composed.length}  skipped: ${skipped.length}  errors: ${errors.length}`);
  lines.push('');
  lines.push(`## Composed (${composed.length})`);
  for (const c of composed) {
    lines.push(`  ${c.groupId}  members=${c.members}  placeholders=${c.usedPlaceholders}  -> ${c.output}`);
  }
  lines.push('');
  lines.push(`## Skipped (${skipped.length})`);
  for (const s of skipped) lines.push(`  ${s.groupId}  --  ${s.reason}`);
  lines.push('');
  lines.push(`## Errors (${errors.length})`);
  for (const e of errors) lines.push(`  ${e.groupId}  --  ${e.error}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`compose-bundle-covers: composed=${composed.length} skipped=${skipped.length} errors=${errors.length}`);
  console.log(`compose-bundle-covers: report -> ${REPORT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2**: Run: `npx tsx scripts/compose-bundle-covers.ts`. Expected: composed≈60-62, errors=0. Verify: `ls public/images/bundles/ | wc -l` → 62+.

- [ ] **Step 3**: Commit:

```bash
git add scripts/compose-bundle-covers.ts data/products.json public/images/bundles/ scripts/compose-bundle-covers-report.txt
git commit -m "feat(scripts): composite bundle covers (sharp grid 800x800)"
```

---

## Task 3: Brand rename — Lumière → Lumée Maison

**Files:**
- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- `app/[locale]/catalogue/page.tsx`
- `app/[locale]/layout.tsx` (check metadata)
- `messages/en.json`
- `messages/ko.json`
- `messages/ru.json`

- [ ] **Step 1**: In each file, replace EVERY occurrence of `Lumière` with `Lumée Maison`. Use Edit with `replace_all=true`. For example:

```
Edit components/layout/Header.tsx
  old_string: "Lumière"
  new_string: "Lumée Maison"
  replace_all: true
```

Repeat for the other 6 files. The Korean / Russian JSONs use `Lumière` as a token inside Hangul / Cyrillic — replacing only the Latin token preserves surrounding language.

- [ ] **Step 2**: Verify no leftovers:

```bash
grep -rEn "Lumière" components/ messages/ app/ 2>&1 | head -10
```

Expected: empty (or only this report).

- [ ] **Step 3**: TypeScript: `npx tsc --noEmit -p tsconfig.json` — zero errors.

- [ ] **Step 4**: Commit:

```bash
git add components/layout/Header.tsx components/layout/Footer.tsx app/[locale]/catalogue/page.tsx app/[locale]/layout.tsx messages/en.json messages/ko.json messages/ru.json
git commit -m "chore: rename brand Lumière -> Lumée Maison"
```

---

## Task 4: Catalogue count display + 438 → 421

**Files:**
- `components/catalogue/CatalogueClient.tsx`
- `app/[locale]/catalogue/page.tsx`
- `components/home/Hero.tsx`
- `messages/en.json`
- `messages/ko.json`
- `messages/ru.json`

- [ ] **Step 1**: In `components/catalogue/CatalogueClient.tsx`, find the count display at line ~390:

```tsx
              {renders.length} {t('products')}
```

Replace with:

```tsx
              {renders.length} cards / {variantCounts ? Array.from(variantCounts.values()).reduce((s, n) => s + n, 0) + renders.filter(r => !r.product.groupId).length : renders.length} products
```

NOTE: there is a `variantCounts: Map<groupId, number>` computed in the same component earlier. Use it. The total = sum of all variant counts + count of solo-group renders.

Actually simpler — derive once near the top, right after `variantCounts` is computed:

```tsx
const totalProductsRepresented = useMemo(() => {
  // Sum of bundle members displayed plus solo (non-grouped) products.
  let total = 0;
  for (const r of filterResult.renders) {
    if (r.asBundle && r.product.groupId) {
      total += variantCounts.get(r.product.groupId) ?? 1;
    } else if (!r.product.groupId) {
      total += 1;
    }
    // In dual-view, the individual solo cards for grouped products are
    // already counted via the bundle card's variantCounts entry — don't double-count.
  }
  return total;
}, [filterResult, variantCounts]);
```

Then the JSX becomes:

```tsx
              {renders.length} cards / {totalProductsRepresented} products
```

- [ ] **Step 2**: In `app/[locale]/catalogue/page.tsx` line 27, replace `438` with `421`. Add a one-line comment: `{/* keep in sync with data/products.json */}` on the line above.

- [ ] **Step 3**: In `components/home/Hero.tsx` line ~137, replace `'438'` with `'421'`. Add a one-line comment near it.

- [ ] **Step 4**: In `messages/en.json` / `ko.json` / `ru.json`, replace `438` with `421` in the catalogue subtitle (one occurrence per file).

- [ ] **Step 5**: TypeScript: `npx tsc --noEmit` — zero errors.

- [ ] **Step 6**: Commit:

```bash
git add components/catalogue/CatalogueClient.tsx app/[locale]/catalogue/page.tsx components/home/Hero.tsx messages/en.json messages/ko.json messages/ru.json
git commit -m "feat(catalogue): show N cards / M products + 438 -> 421"
```

---

## Task 5: Text size + rounded corners

**Files:**
- `components/catalogue/CatalogueClient.tsx`
- `components/catalogue/ProductCard.tsx`

- [ ] **Step 1**: In `components/catalogue/CatalogueClient.tsx`, for the SIDEBAR (`<aside>` block) and the TOP BAR + the FILTER QUICK FILTERS section, apply class swaps:
  - `text-[10px]` → `text-xs`
  - `text-xs` → `text-sm` (only in text-content positions — sidebar category items, top-bar count, filter labels)
  - `rounded-sm` → `rounded-md` (on buttons and badges that aren't tiny icon pills)

Use targeted Edit ops — read the relevant section, identify each class, swap. Do NOT do a blind `replace_all`. The component is ≈515 lines; the changes should be ≈20 line edits total.

Skip:
- icon-only buttons (e.g., the X / Filter icon buttons) — their `text-xs` is a sizing token for the icon, not text.
- absolute-positioned overlays where `text-[10px]` is intentional for tightness.

- [ ] **Step 2**: In `components/catalogue/ProductCard.tsx`, for both the LIST and GRID branches, apply:
  - `text-xs` → `text-sm` on the product name `<h3>` and the spec `<p>`
  - `text-[9px]` → `text-[10px]` on the "N options" indicator
  - `rounded-sm` → `rounded-md` on the card's outer container (`bg-white border ...`)
  - `p-4` → `p-5` on the card body padding inside the grid layout

- [ ] **Step 3**: TypeScript: `npx tsc --noEmit` — zero errors.

- [ ] **Step 4**: Commit:

```bash
git add components/catalogue/CatalogueClient.tsx components/catalogue/ProductCard.tsx
git commit -m "feat(catalogue): bump text size 1 tier + rounded-md corners"
```

---

## Task 6: Manual verification

**Files:** none modified.

- [ ] **Step 1**: Boot dev server if not running: `npm run dev`.

- [ ] **Step 2**: `/en` home → Hero shows 421 products.

- [ ] **Step 3**: `/en/catalogue` → top bar reads "290 cards / 421 products" (unfiltered).

- [ ] **Step 4**: Filter by Bundles → cards display composite covers (multiple variant images in a grid). Click a bundle → variant dropdown still shows real variants.

- [ ] **Step 5**: Header / Footer say "Lumée Maison", not "Lumière".

- [ ] **Step 6**: Open any product detail page → protocol is 1 sentence.

- [ ] **Step 7**: Catalogue sidebar and cards: text noticeably bigger, corners softer.

- [ ] **Step 8**: Browser console: no errors.

---

## Out of scope (follow-ups)

- Translating updated English copy into Russian / Korean.
- Text labels on bundle covers.
- Dynamic build-time computation of the product count to replace hardcoded 421.
