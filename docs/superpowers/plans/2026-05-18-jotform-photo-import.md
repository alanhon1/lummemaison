# JotForm Product Photo Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the wiped 438 product photos by scraping them from the brand's canonical JotForm and re-attaching them to `data/products.json` via fuzzy name matching.

**Architecture:** One Node script at `scripts/sync-from-jotform.ts`, modeled on the existing `scripts/sync-from-aesthetics-shop.ts`. Pipeline = fetch JotForm HTML → parse with cheerio (with regex fallback) → fuzzy-match against `products.json` using the shared `scripts/lib/fuzzy-match.ts` helpers → download via axios → convert via sharp → save as webp → update JSON → emit reports.

**Tech Stack:** TypeScript 5, Node 20+, `axios`, `cheerio`, `sharp`, `tsx` — all already in `package.json`. No new dependencies. No test framework — verification = `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus inspecting the audit reports and `public/images/products/`.

**Spec:** `docs/superpowers/specs/2026-05-18-jotform-photo-import-design.md` (commit `176560c`).

---

## File Structure

**Created files:**
- `scripts/sync-from-jotform.ts` — the full pipeline (Task 1).
- `scripts/jotform-raw.html` — raw HTML dump for audit/debug (gitignored; produced at runtime).
- `scripts/jotform-scrape.json` — parsed products dump (gitignored; produced at runtime).
- `scripts/jotform-sync-report.txt` — match/download audit (committed for traceability).

**Modified files:**
- `package.json` — add npm-script entry `"sync-from-jotform": "tsx scripts/sync-from-jotform.ts"`.
- `data/products.json` — `image` field updated per matched product (Task 2 execution).
- `data/backups/products-<timestamp>.json` — backup created by the script (Task 2 execution).
- `public/images/products/product-<id>.webp` — one per matched product (Task 2 execution).

**Reused (unchanged):**
- `scripts/lib/fuzzy-match.ts` — `normalise` + `scoreMatch` helpers.
- `scripts/derive-group-display.ts` — re-runs after the sync to refresh `groupImage` on the 33 grouped products (Task 2).

**Gitignored runtime artifacts:**
Add to `.gitignore` (Task 1 step):
```
scripts/jotform-raw.html
scripts/jotform-scrape.json
```
These can grow to several MB and aren't useful in git.

---

## Task 1: Build `sync-from-jotform.ts`

**Files:**
- Create: `scripts/sync-from-jotform.ts`
- Modify: `package.json` (one new script entry)
- Modify: `.gitignore` (two new lines)

Implement the full pipeline as code. No execution in this task — Task 2 runs it.

### Step 1: Add the gitignore entries

In `.gitignore`, append:

```
# Sync-from-jotform runtime artifacts
scripts/jotform-raw.html
scripts/jotform-scrape.json
```

### Step 2: Create the script

Create `scripts/sync-from-jotform.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const JOTFORM_URL = 'https://form.jotform.com/shcoresteticsglobal/skin-global-product-order-form';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');
const RAW_HTML_PATH = path.join(ROOT, 'scripts', 'jotform-raw.html');
const SCRAPE_JSON_PATH = path.join(ROOT, 'scripts', 'jotform-scrape.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'jotform-sync-report.txt');

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const MATCH_THRESHOLD = 4;

interface JotformProduct {
  name: string;
  imageUrl: string;
}

interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}

interface Match {
  product: Product;
  jp: JotformProduct;
  score: number;
}

async function fetchHtml(): Promise<string> {
  console.log(`Fetching ${JOTFORM_URL} …`);
  const res = await axios.get<string>(JOTFORM_URL, {
    timeout: 60_000,
    responseType: 'text',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const html = res.data;
  fs.writeFileSync(RAW_HTML_PATH, html, 'utf8');
  console.log(`Saved raw HTML (${html.length} bytes) to ${RAW_HTML_PATH}`);
  return html;
}

/**
 * Extract products from JotForm HTML.
 *
 * JotForm structures vary by widget. We try cheerio selectors first, then
 * fall back to a regex that pulls every <img> whose src points at the
 * uploads bucket and finds the nearest text node above it.
 */
function parseProducts(html: string): JotformProduct[] {
  const $ = cheerio.load(html);
  const products: JotformProduct[] = [];
  const seen = new Set<string>();

  // Strategy 1: walk every image with a JotForm uploads URL and find nearby text.
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src.includes('jotform.com/uploads/')) return;
    if (seen.has(src)) return;

    // Look for the nearest preceding text that looks like a product name.
    // JotForm cards usually have the name in a label or heading element
    // within the same parent container.
    let name = '';
    let node = $(el).parent();
    for (let i = 0; i < 6 && !name && node.length; i++) {
      // Try labels, headings, common JotForm name classes
      const candidates = node
        .find('label, h1, h2, h3, h4, h5, .form-product-name, [class*="product-name"]')
        .toArray();
      for (const c of candidates) {
        const txt = $(c).text().trim();
        if (txt && txt.length < 200 && !/^\$|^\d/.test(txt)) {
          name = txt;
          break;
        }
      }
      if (!name) node = node.parent();
    }

    if (name) {
      seen.add(src);
      products.push({ name: cleanName(name), imageUrl: src });
    }
  });

  // Strategy 2: regex fallback for anything Strategy 1 missed.
  // Scan for <img ... src="..jotform.com/uploads/..." ...> and back-walk text.
  if (products.length < 200) {
    console.warn(
      `Cheerio extraction returned only ${products.length} products; running regex fallback.`,
    );
    const imgRe =
      /<img[^>]+src="(https?:\/\/[^"]*jotform\.com\/uploads\/[^"]+)"[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html)) !== null) {
      const url = m[1];
      if (seen.has(url)) continue;
      // Look back ~2000 chars for the nearest plausible name string.
      const start = Math.max(0, m.index - 2000);
      const slice = html.slice(start, m.index);
      const textMatches = slice.match(/>([A-Za-z][A-Za-z0-9 +\-/().#]{2,80})</g) || [];
      const candidates = textMatches
        .map(t => t.replace(/^>|<$/g, '').trim())
        .filter(t => t.length > 2 && !/^\$/.test(t))
        .filter(t => !/^(home|next|prev|select|quantity|item)$/i.test(t));
      const name = candidates[candidates.length - 1];
      if (name) {
        seen.add(url);
        products.push({ name: cleanName(name), imageUrl: url });
      }
    }
  }

  console.log(`Parsed ${products.length} products from JotForm HTML.`);
  fs.writeFileSync(SCRAPE_JSON_PATH, JSON.stringify(products, null, 2) + '\n', 'utf8');
  return products;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-—–•·]+|[\s\-—–•·]+$/g, '')
    .trim();
}

interface ProductsFile {
  categories: Array<{ id: string; name: string; range: [number, number] }>;
  products: Product[];
}

function matchAll(products: Product[], scraped: JotformProduct[]): {
  matched: Match[];
  unmatchedProducts: Product[];
  unmatchedScraped: JotformProduct[];
} {
  const matched: Match[] = [];
  const consumed = new Set<JotformProduct>();

  // Sort products by name length descending — longer names have more specific
  // tokens and match more reliably; greedy ordering reduces conflicts.
  const ordered = [...products].sort((a, b) => b.name.length - a.name.length);

  for (const product of ordered) {
    const pnorm = normalise(product.name);
    let best: { jp: JotformProduct; score: number } | null = null;
    for (const jp of scraped) {
      if (consumed.has(jp)) continue;
      const s = scoreMatch(pnorm, normalise(jp.name));
      if (!best || s > best.score) {
        best = { jp, score: s };
      }
    }
    if (best && best.score >= MATCH_THRESHOLD) {
      consumed.add(best.jp);
      matched.push({ product, jp: best.jp, score: best.score });
    }
  }

  const matchedProductIds = new Set(matched.map(m => m.product.id));
  const unmatchedProducts = products.filter(p => !matchedProductIds.has(p.id));
  const unmatchedScraped = scraped.filter(jp => !consumed.has(jp));

  return { matched, unmatchedProducts, unmatchedScraped };
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

async function downloadAll(matches: Match[]): Promise<{
  downloaded: number;
  skipped: number;
  failed: Array<{ id: number; name: string; url: string; error: string }>;
}> {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  const failed: Array<{ id: number; name: string; url: string; error: string }> = [];

  for (const m of matches) {
    const dest = path.join(OUTPUT_DIR, `product-${m.product.id}.webp`);
    if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++;
      continue;
    }
    try {
      await downloadImage(m.jp.imageUrl, dest);
      downloaded++;
      console.log(`✓ ${m.product.id} ${m.product.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ id: m.product.id, name: m.product.name, url: m.jp.imageUrl, error: msg });
      console.warn(`✗ ${m.product.id} ${m.product.name} — ${msg}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { downloaded, skipped, failed };
}

function backupJson(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function updateJson(file: ProductsFile, matches: Match[], downloadedIds: Set<number>): void {
  for (const p of file.products) {
    const m = matches.find(x => x.product.id === p.id);
    if (m && downloadedIds.has(p.id)) {
      p.image = `/images/products/product-${p.id}.webp`;
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(file, null, 2) + '\n', 'utf8');
}

function writeReport(args: {
  scraped: number;
  totalProducts: number;
  matched: Match[];
  unmatchedProducts: Product[];
  unmatchedScraped: JotformProduct[];
  downloaded: number;
  skipped: number;
  failed: Array<{ id: number; name: string; url: string; error: string }>;
}): void {
  const lines: string[] = [];
  lines.push(`JotForm sync — ${new Date().toISOString()}`);
  lines.push('='.repeat(48));
  lines.push('');
  lines.push(`JotForm products scraped: ${args.scraped}`);
  lines.push(`Products in products.json: ${args.totalProducts}`);
  lines.push(`Matched: ${args.matched.length} / ${args.totalProducts}`);
  lines.push(`Downloaded: ${args.downloaded}  Skipped (already present): ${args.skipped}  Failed: ${args.failed.length}`);
  lines.push('');

  if (args.unmatchedProducts.length) {
    lines.push(`Products with no JotForm match (${args.unmatchedProducts.length}):`);
    for (const p of args.unmatchedProducts) {
      lines.push(`  - id ${p.id}  "${p.name}"  (${p.categoryId})`);
    }
    lines.push('');
  }

  if (args.unmatchedScraped.length) {
    lines.push(`JotForm products with no products.json match (${args.unmatchedScraped.length}):`);
    for (const jp of args.unmatchedScraped) {
      lines.push(`  - "${jp.name}"  ${jp.imageUrl}`);
    }
    lines.push('');
  }

  if (args.failed.length) {
    lines.push(`Failed downloads (${args.failed.length}):`);
    for (const f of args.failed) {
      lines.push(`  - id ${f.id}  "${f.name}"  ${f.error}`);
    }
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

async function main(): Promise<void> {
  const html = await fetchHtml();
  const scraped = parseProducts(html);

  const file = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as ProductsFile;
  const products = file.products;

  const { matched, unmatchedProducts, unmatchedScraped } = matchAll(products, scraped);
  console.log(
    `Matched ${matched.length}/${products.length}. Unmatched products: ${unmatchedProducts.length}. Unclaimed scraped: ${unmatchedScraped.length}.`,
  );

  let downloaded = 0;
  let skipped = 0;
  let failed: Array<{ id: number; name: string; url: string; error: string }> = [];

  if (!DRY_RUN) {
    const backupPath = backupJson();
    console.log(`Backed up products.json to ${backupPath}`);
    const r = await downloadAll(matched);
    downloaded = r.downloaded;
    skipped = r.skipped;
    failed = r.failed;
    const downloadedIds = new Set(matched.filter(m => !failed.find(f => f.id === m.product.id)).map(m => m.product.id));
    updateJson(file, matched, downloadedIds);
    console.log(`Updated ${downloadedIds.size} image field(s) in products.json`);
  } else {
    console.log('[dry-run] Skipping downloads + JSON update.');
  }

  writeReport({
    scraped: scraped.length,
    totalProducts: products.length,
    matched,
    unmatchedProducts,
    unmatchedScraped,
    downloaded,
    skipped,
    failed,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### Step 3: Add npm script entry

In `package.json`, append to `"scripts"`:

```json
    "sync-from-jotform": "tsx scripts/sync-from-jotform.ts"
```

(Maintain trailing-comma JSON correctness — place this before the closing `}` of `scripts`.)

### Step 4: Typecheck

Run: `npx tsc --noEmit`. Expected: exit 0.

If TypeScript complains about `cheerio` types (sometimes the `*` import vs named export differs), the fix is one of:
- Change `import * as cheerio from 'cheerio';` to `import { load } from 'cheerio';` and use `load(html)` directly.
- Or fall back to `const cheerio = require('cheerio');` with a `// eslint-disable-next-line @typescript-eslint/no-require-imports`.

Pick whichever produces exit 0.

### Step 5: Lint

Run: `npm run lint`. Expected: 70 problems baseline. If the new script raises problems (e.g. `no-explicit-any`), fix them in the new file only. Do not touch other files.

### Step 6: Commit

```bash
git add scripts/sync-from-jotform.ts package.json .gitignore
git commit -m "feat(scripts): sync-from-jotform.ts — scrape, match, download photos"
```

---

## Task 2: Run the pipeline + refresh group covers + verify

**Files:**
- Modify (via script): `data/products.json`, creates `data/backups/products-<timestamp>.json`
- Created (via script): `public/images/products/product-<id>.webp` (one per matched product), `scripts/jotform-sync-report.txt`

### Step 1: Dry-run

Run: `npm run sync-from-jotform -- --dry-run`

This fetches the JotForm, parses, matches, and writes `scripts/jotform-sync-report.txt` and `scripts/jotform-scrape.json`. No downloads, no JSON mutation.

Expected console:
```
Fetching https://form.jotform.com/shcoresteticsglobal/skin-global-product-order-form …
Saved raw HTML (NNN bytes) to scripts/jotform-raw.html
Parsed ~400-500 products from JotForm HTML.
Matched ~400/438. Unmatched products: ~30. Unclaimed scraped: ~50.
[dry-run] Skipping downloads + JSON update.
Report written to scripts/jotform-sync-report.txt
```

### Step 2: Inspect the dry-run report

Read `scripts/jotform-sync-report.txt`. Verify:

1. `JotForm products scraped:` is roughly 400-500 (sanity check the scrape worked).
2. `Matched:` is at least 350 / 438 (target: ≥80% match rate).
3. The unmatched-products list is small and contains products with unusual names (good — those are genuine edge cases).

**If match rate < 80%:** Inspect a few unmatched products and corresponding unclaimed scraped entries. The threshold may need tuning (try `MATCH_THRESHOLD = 3` in the script), or the parser may have garbage names (look at `scripts/jotform-scrape.json`).

**If parser produced fewer than 200 scraped entries:** the cheerio selector strategy failed. Look at `scripts/jotform-raw.html` — find a product name in the file and inspect its surrounding markup. Update the parser's selector strategy in `parseProducts()` based on what you see. Re-run dry-run. Iterate up to 2 rounds; if still failing, escalate as BLOCKED.

If you adjust the parser/threshold, commit the change first as `fix(scripts): tune jotform parser/threshold`, then re-run dry-run.

### Step 3: Real run

Once dry-run looks good, run: `npm run sync-from-jotform`

This downloads all matched images (~400 downloads, ~100ms each = ~40 seconds + transfer time) and updates `products.json`.

Expected console: a stream of `✓ <id> <name>` lines, occasional `✗` for failures, then a summary.

Verify after:
- `public/images/products/` contains ~400 `product-<id>.webp` files. Use `ls public/images/products/ | wc -l`.
- `scripts/jotform-sync-report.txt` reflects the real run (downloads ≥ 350).
- `data/backups/products-<timestamp>.json` exists.

### Step 4: Refresh `groupImage` for grouped products

The catalogue dedupes grouped products by `groupId` and uses `groupImage` as the card cover. After the sync, group covers need re-deriving from the new images.

Run: `npm run derive-groups`

Expected: the script prints how many groups had their `groupImage` updated. Read `data/products.json` to spot-check a grouped product (e.g. find one with `groupId === 'sosum'` and confirm `groupImage` is now a `/images/products/product-N.webp` path).

### Step 5: Verify gates

Run all three:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected:
- `tsc` exit 0.
- `lint` baseline 70 (no regression).
- `build` exit 0, all 38 routes still generate.

### Step 6: Manual UI smoke

Run `npm run dev`. Open in browser:
- `http://localhost:3000/en/catalogue` — every product card now has a real photo (instead of the placeholder gradient).
- `http://localhost:3000/en/product/1` — gallery shows the photo, crossfade still works, lightbox opens correctly on click.
- A grouped product URL (find one from the sosum group via `node -e "const d=require('./data/products.json'); console.log(d.products.filter(p=>p.groupId==='sosum').map(p=>p.id))"`) — variant selector works, `<`/`>` cross-variant nav still works.

Stop `npm run dev`.

### Step 7: Commit

```bash
git add data/products.json data/backups/ public/images/products/ scripts/jotform-sync-report.txt
git commit -m "feat(data): import 438 product photos from JotForm + refresh group covers"
```

(Use `git status` first to confirm only the expected paths are staged. The `.gitignore`d runtime files — `scripts/jotform-raw.html` and `scripts/jotform-scrape.json` — should not appear.)

---

## Final verification

After both tasks complete:

- [ ] `git status` clean except `.claude/settings.local.json`.
- [ ] `public/images/products/` has ~400 webp files plus `.gitkeep`.
- [ ] `data/products.json`: at least 350 of 438 products have a non-empty `image`.
- [ ] `scripts/jotform-sync-report.txt` committed; readable.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] Manual smoke on `/en/catalogue` confirms photos render.

Any unmatched products listed in the report become a follow-up: either source the image manually, run a complementary sitemap-based scraper (`sync-from-aesthetics-shop`, `sync-from-gofillerss`), or leave with the placeholder until the next sync.
