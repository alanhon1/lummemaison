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
