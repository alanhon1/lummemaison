# Product Images & Descriptions Population Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the 326 product images from `lumeemasonpic/` into `public/images/products/` with correct `products.json` references, and populate the `description` field for all 438 products using the PDF catalogue, with DuckDuckGo web search as fallback for entries with descriptions shorter than 60 characters.

**Architecture:** Two standalone `tsx` scripts: `sync-product-images.ts` matches each product to the best image in `lumeemasonpic/catalogue/categories/` via slug comparison, copies it to the web-served folder, and updates `products.json`. `fill-descriptions.ts` parses `lumeemasonpic/pdf-content.txt` by product number, then web-searches any product whose PDF text is too short, and writes the result back to `products.json`. Neither script is interactive — both write progress to stdout and a report file.

**Tech Stack:** TypeScript, `tsx` (already installed), Node.js `fs`/`path`, `axios`, `cheerio`, `sharp` — all already in `package.json`.

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `package.json` | Add two npm script entries |
| Create | `scripts/sync-product-images.ts` | Image matching + copy + products.json update |
| Create | `scripts/fill-descriptions.ts` | PDF parse + web fallback + products.json update |
| Modify | `data/products.json` | Updated `image` and `description` fields |
| Generated | `scripts/image-sync-report.txt` | Matched / fallback / unmatched image log |
| Generated | `scripts/description-report.txt` | PDF-sourced / web-sourced / failed description log |

---

## Task 1: Extract lumeemasonpic.zip

**Files:**
- Modify: `lumeemasonpic/` (populated from zip)

- [ ] **Step 1: Extract the zip**

Run in PowerShell from the project root:

```powershell
Expand-Archive -Path "lumeemasonpic.zip" -DestinationPath "." -Force
```

Expected: no error. If it prints "already exists" style warnings, that is fine — `-Force` overwrites.

- [ ] **Step 2: Verify image count**

```powershell
(Get-ChildItem "lumeemasonpic\catalogue\categories" -Recurse -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp)' }).Count
```

Expected output: `326` (or higher if the zip contained additional images).

- [ ] **Step 3: Commit**

```bash
git add lumeemasonpic/
git commit -m "chore: extract lumeemasonpic product images from zip"
```

---

## Task 2: Write sync-product-images.ts

**Files:**
- Create: `scripts/sync-product-images.ts`

- [ ] **Step 1: Create the script**

Create `scripts/sync-product-images.ts` with this exact content:

```typescript
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const LUMEEMASON_DIR = path.join(process.cwd(), 'lumeemasonpic', 'catalogue', 'categories');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'image-sync-report.txt');

// Maps category folder name → products.json categoryId
const CAT_FOLDER_MAP: Record<string, string> = {
  'catalogue-categories-fillers': 'fillers',
  'catalogue-categories-mesotherapy-biorevitalization': 'mesotherapy',
  'catalogue-categories-acne-treatment': 'acne-treatment',
  'catalogue-categories-hair-treatment': 'hair-treatment',
  'catalogue-categories-pharmacy-favourites': 'pharmacy-favourites',
  'catalogue-categories-topical-cosmetics': 'topical-cosmetics',
  'catalogue-categories-intimate-care': 'intimate-care',
  'catalogue-categories-growth-factor-exosome': 'growth-factor-exosome',
  'catalogue-categories-curenex': 'curenex',
  'catalogue-categories-dermagen': 'dermagen',
  'catalogue-categories-gtm': 'gtm',
  'catalogue-categories-equipment': 'equipment',
  'catalogue-categories-salon-grade': 'salon-grade',
  'catalogue-categories-lipolytics': 'lipolytics',
  'catalogue-categories-botulinum-therapy': 'botulinum',
  'catalogue-categories-injections': 'injections',
  'catalogue-categories-anesthetics': 'anesthetics',
  'catalogue-categories-placental-therapy': 'placental-therapy',
  'catalogue-categories-nano-needle-cannula': 'nano-needle-cannula',
  'catalogue-categories-imported-products': 'imported-products',
};

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Score how well an image filename matches a product slug.
// +2 for exact word match, +1 for substring match.
function scoreImage(imagePath: string, productSlug: string): number {
  const base = path.basename(imagePath, path.extname(imagePath));
  const imgSlug = nameToSlug(base);
  const imgWords = imgSlug.split('-');
  const productWords = productSlug.split('-').filter(w => w.length > 2);
  let score = 0;
  for (const word of productWords) {
    if (imgWords.includes(word)) score += 2;
    else if (imgSlug.includes(word)) score += 1;
  }
  return score;
}

type MatchType = 'exact' | 'prefix' | 'word-match' | 'fallback';

interface MatchResult {
  sourcePath: string;
  matchType: MatchType;
}

function findBestImage(
  productSlug: string,
  brandMap: Map<string, string[]>
): MatchResult | null {
  // 1. Exact brand-folder name match
  if (brandMap.has(productSlug)) {
    const images = brandMap.get(productSlug)!;
    const best = [...images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return { sourcePath: best, matchType: 'exact' };
  }

  // 2. Product slug begins with a known brand slug
  // e.g. "regenovue-fine-plus-ce" → brand "regenovue"
  let prefixMatch: { images: string[]; brandLen: number } | null = null;
  for (const [brand, images] of brandMap) {
    if (productSlug === brand || productSlug.startsWith(brand + '-')) {
      if (!prefixMatch || brand.length > prefixMatch.brandLen) {
        prefixMatch = { images, brandLen: brand.length };
      }
    }
  }
  if (prefixMatch) {
    const best = [...prefixMatch.images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return { sourcePath: best, matchType: 'prefix' };
  }

  // 3. Brand folder that shares the most words with the product slug
  const productWords = new Set(productSlug.split('-').filter(w => w.length > 2));
  let bestWordMatch: { images: string[]; overlap: number } | null = null;
  for (const [brand, images] of brandMap) {
    const brandWords = brand.split('-').filter(w => w.length > 2);
    const overlap = brandWords.filter(w => productWords.has(w)).length;
    if (overlap >= 1 && (!bestWordMatch || overlap > bestWordMatch.overlap)) {
      bestWordMatch = { images, overlap };
    }
  }
  if (bestWordMatch) {
    const best = [...bestWordMatch.images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return {
      sourcePath: best,
      matchType: bestWordMatch.overlap >= 2 ? 'word-match' : 'fallback',
    };
  }

  return null;
}

interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Product[];

  // Build imageMap: categoryId → Map<brandSlug, absoluteImagePaths[]>
  const imageMap = new Map<string, Map<string, string[]>>();
  for (const [folder, catId] of Object.entries(CAT_FOLDER_MAP)) {
    const catPath = path.join(LUMEEMASON_DIR, folder);
    if (!fs.existsSync(catPath)) continue;
    const brandMap = new Map<string, string[]>();
    for (const entry of fs.readdirSync(catPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const brandPath = path.join(catPath, entry.name);
      const images = fs.readdirSync(brandPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => path.join(brandPath, f));
      if (images.length) brandMap.set(entry.name, images);
    }
    imageMap.set(catId, brandMap);
  }

  const matched: string[] = [];
  const fallbacks: string[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    const brandMap = imageMap.get(p.categoryId);
    if (!brandMap) {
      unmatched.push(`#${p.id} ${p.name} (no category folder for "${p.categoryId}")`);
      process.stdout.write(`${prefix} ✗ ${p.name} — no category folder\n`);
      continue;
    }

    const productSlug = nameToSlug(p.name);
    const result = findBestImage(productSlug, brandMap);

    if (!result) {
      unmatched.push(`#${p.id} ${p.name} (slug: "${productSlug}", no brand match)`);
      process.stdout.write(`${prefix} ✗ ${p.name} — no match\n`);
      continue;
    }

    const ext = path.extname(result.sourcePath).toLowerCase();
    const destFilename = `product-${p.id}${ext}`;
    const destPath = path.join(OUTPUT_DIR, destFilename);
    fs.copyFileSync(result.sourcePath, destPath);
    data.products[i].image = `/images/products/${destFilename}`;

    const relSrc = path.relative(process.cwd(), result.sourcePath).replace(/\\/g, '/');
    const logLine = `#${p.id} ${p.name} ← ${relSrc} [${result.matchType}]`;

    if (result.matchType === 'fallback') {
      fallbacks.push(logLine);
    } else {
      matched.push(logLine);
    }

    process.stdout.write(`${prefix} ✓ ${p.name} (${result.matchType})\n`);

    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== MATCHED (${matched.length}) ===`,
    ...matched,
    '',
    `=== FALLBACK / AMBIGUOUS (${fallbacks.length}) ===`,
    ...fallbacks,
    '',
    `=== UNMATCHED — kept existing image (${unmatched.length}) ===`,
    ...unmatched,
  ].join('\n');

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  process.stdout.write(`\nDone. Matched: ${matched.length}, Fallback: ${fallbacks.length}, Unmatched: ${unmatched.length}\n`);
  process.stdout.write(`Full report: scripts/image-sync-report.txt\n`);
}

main().catch(console.error);
```

---

## Task 3: Run image sync

**Files:**
- Modify: `package.json`
- Modify: `data/products.json`
- Generated: `scripts/image-sync-report.txt`

- [ ] **Step 1: Add npm script to package.json**

In `package.json`, add to the `"scripts"` block:

```json
"sync-images": "tsx scripts/sync-product-images.ts"
```

- [ ] **Step 2: Run the script**

```bash
npm run sync-images
```

Expected output (example):
```
[1/438] ✓ BARBIE SLIM (exact)
[2/438] ✓ MisAdi Beso (prefix)
[3/438] ✓ REGENOVUE FINE (CE) (prefix)
...
Done. Matched: 310, Fallback: 28, Unmatched: 100
Full report: scripts/image-sync-report.txt
```

Unmatched products keep their existing image path — no data is lost.

- [ ] **Step 3: Review the report**

```bash
cat scripts/image-sync-report.txt
```

Check the FALLBACK section. These are products where the script used the closest brand folder but confidence was low. If any look wrong, they can be fixed via the admin panel at `/manzura/products`.

- [ ] **Step 4: Commit**

```bash
git add data/products.json scripts/sync-product-images.ts scripts/image-sync-report.txt package.json
git commit -m "feat: sync product images from lumeemasonpic catalogue"
```

---

## Task 4: Write fill-descriptions.ts

**Files:**
- Create: `scripts/fill-descriptions.ts`

- [ ] **Step 1: Create the script**

Create `scripts/fill-descriptions.ts` with this exact content:

```typescript
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const PDF_TEXT_FILE = path.join(process.cwd(), 'lumeemasonpic', 'pdf-content.txt');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'description-report.txt');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIN_DESC_LENGTH = 60;

interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
}

// Parses pdf-content.txt → Map<productId, rawEntryText>
// Each entry is the text between "N.  " and the start of the next entry.
function parsePdfEntries(pdfText: string): Map<number, string> {
  const map = new Map<number, string>();

  // Flatten: remove page markers, collapse whitespace to single spaces
  const flat = pdfText
    .replace(/---\s*Page\s*\d+\s*---/g, ' ')
    .replace(/\(\s*\d+\s*\)\s+[A-Z\/\s&]+(?:№\s+PRODUCT NAME\s+SPECIFICATION\s+PRODUCT IMAGE\s+PRICE)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (let id = 1; id <= 438; id++) {
    // Find "id.  " (word boundary to avoid matching e.g. "31." inside "131.")
    const startRe = new RegExp(`(?<![\\d])${id}\\.\\s+`);
    const startMatch = startRe.exec(flat);
    if (!startMatch) continue;

    const contentStart = startMatch.index + startMatch[0].length;
    const remaining = flat.slice(contentStart);

    // Entry ends at the next sequential product number or category header
    const nextId = id + 1;
    const endRe = new RegExp(`(?<![\\d])${nextId}\\.\\s+`);
    const endMatch = endRe.exec(remaining);

    const entry = endMatch
      ? remaining.slice(0, endMatch.index)
      : remaining.slice(0, 2000);

    map.set(id, entry.replace(/\s+/g, ' ').trim());
  }

  return map;
}

// Extracts the meaningful description portion from a raw PDF entry.
// Strips price tokens and returns whatever benefit/ingredient text remains.
function extractDescription(raw: string): string {
  let text = raw;

  // Remove price pattern (e.g., "$ 45 .00", "$160.00", "$3800")
  text = text.replace(/\$\s*[\d,\s]+\.?\s*\d{0,2}/g, '');

  // Remove "NEW!", "ON SALE!" labels
  text = text.replace(/\b(NEW|ON SALE|SALE)\s*!?\s*/gi, '');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// DuckDuckGo search + page scrape, returns first relevant sentence (>60 chars).
async function webSearchDescription(productName: string): Promise<string> {
  const query = `"${productName}" skin aesthetic filler treatment description`;
  try {
    await sleep(2000);
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    const urls: string[] = [];
    $('.result__url').each((_, el) => {
      const href = $(el).text().trim();
      if (href && !href.includes('duckduckgo') && urls.length < 3) {
        urls.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });

    for (const url of urls.slice(0, 2)) {
      await sleep(900);
      try {
        const pageRes = await axios.get(url, {
          headers: { 'User-Agent': UA },
          timeout: 12000,
        });
        const $page = cheerio.load(pageRes.data);
        $page('script,style,nav,footer,header,aside').remove();
        const bodyText = $page('body').text().replace(/\s+/g, ' ').trim();

        // Split into sentence-like chunks, pick first one relevant to the product
        const chunks = bodyText
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > MIN_DESC_LENGTH && s.length < 500);

        const nameWords = productName
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3);

        const relevant = chunks.find(chunk => {
          const lower = chunk.toLowerCase();
          const hasProductWord = nameWords.some(w => lower.includes(w));
          const hasContext =
            lower.includes('skin') ||
            lower.includes('injection') ||
            lower.includes('hyaluronic') ||
            lower.includes('filler') ||
            lower.includes('treatment') ||
            lower.includes('collagen') ||
            lower.includes('benefit') ||
            lower.includes('ingredient');
          return hasProductWord && hasContext;
        });

        if (relevant) return relevant;
      } catch {
        continue;
      }
    }
  } catch { }
  return '';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Product[];
  const pdfText = fs.readFileSync(PDF_TEXT_FILE, 'utf8');

  process.stdout.write('Parsing PDF entries...\n');
  const pdfEntries = parsePdfEntries(pdfText);
  process.stdout.write(`Parsed ${pdfEntries.size} PDF entries.\n\n`);

  const pdfSourced: string[] = [];
  const webSourced: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const rawEntry = pdfEntries.get(p.id) ?? '';

    const pdfDesc = extractDescription(rawEntry);

    if (pdfDesc.length >= MIN_DESC_LENGTH) {
      data.products[i].description = pdfDesc;
      pdfSourced.push(`#${p.id} ${p.name}`);
      process.stdout.write(`${prefix} ✓ PDF  ${p.name}\n`);
    } else {
      process.stdout.write(`${prefix} → web  ${p.name}...\n`);
      const webDesc = await webSearchDescription(p.name);

      if (webDesc.length >= MIN_DESC_LENGTH) {
        data.products[i].description = webDesc;
        webSourced.push(`#${p.id} ${p.name}`);
        process.stdout.write(`${prefix} ✓ web  ${p.name}\n`);
      } else {
        // Keep existing description unchanged
        const existing = p.description ?? '';
        failed.push(`#${p.id} ${p.name} (kept: "${existing.slice(0, 60)}${existing.length > 60 ? '…' : ''}")`);
        process.stdout.write(`${prefix} ✗      ${p.name} (kept existing)\n`);
      }
    }

    // Checkpoint save every 20 products
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== PDF SOURCED (${pdfSourced.length}) ===`,
    ...pdfSourced,
    '',
    `=== WEB SOURCED (${webSourced.length}) ===`,
    ...webSourced,
    '',
    `=== FAILED / UNCHANGED (${failed.length}) ===`,
    ...failed,
  ].join('\n');

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  process.stdout.write(
    `\nDone. PDF: ${pdfSourced.length}, Web: ${webSourced.length}, Failed/unchanged: ${failed.length}\n`
  );
  process.stdout.write(`Full report: scripts/description-report.txt\n`);
}

main().catch(console.error);
```

---

## Task 5: Run description fill

**Files:**
- Modify: `package.json`
- Modify: `data/products.json`
- Generated: `scripts/description-report.txt`

- [ ] **Step 1: Add npm script to package.json**

In `package.json`, add to the `"scripts"` block:

```json
"fill-descriptions": "tsx scripts/fill-descriptions.ts"
```

- [ ] **Step 2: Run the script**

```bash
npm run fill-descriptions
```

This runs ~438 products. Products with good PDF descriptions finish immediately; those needing web search take ~3–4 seconds each due to rate-limiting sleeps. Full run may take 10–20 minutes.

Expected output (sample):
```
Parsing PDF entries...
Parsed 438 PDF entries.

[1/438] ✓ PDF  BARBIE SLIM
[2/438] ✓ PDF  MisAdi Beso
[3/438] → web  REGENOVUE FINE (CE)...
[3/438] ✓ web  REGENOVUE FINE (CE)
...
Done. PDF: 290, Web: 110, Failed/unchanged: 38
Full report: scripts/description-report.txt
```

- [ ] **Step 3: Review the report**

```bash
cat scripts/description-report.txt
```

Check the FAILED section. Products listed there kept their original description. They can be edited manually via the admin panel at `/manzura/products/<id>`.

- [ ] **Step 4: Commit**

```bash
git add data/products.json scripts/fill-descriptions.ts scripts/description-report.txt package.json
git commit -m "feat: populate product descriptions from PDF catalogue and web search"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: zip extraction ✓, image copy + products.json update ✓, PDF description parse ✓, web search fallback ✓, English descriptions ✓, no git push ✓
- [x] **No placeholders**: all steps have complete code or exact commands
- [x] **Type consistency**: `Product` interface fields (`id`, `name`, `categoryId`, `specification`, `description`, `image`) match `data/products.json` shape throughout both scripts
- [x] **Unmatched products**: both scripts leave unmatched data unchanged (images and descriptions both default to existing values, not null)
- [x] **Checkpoint saves**: both scripts flush `products.json` every 20 products to protect against interruption
