/**
 * Downloads product images from aesthetics-shop.com and updates products.json.
 *
 * Usage:
 *   npx tsx scripts/sync-from-aesthetics-shop.ts          # skip products with existing images
 *   npx tsx scripts/sync-from-aesthetics-shop.ts --force  # overwrite all
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'aesthetics-sync-report.txt');
const SITEMAP_URL = 'https://aesthetics-shop.com/product-sitemap.xml';
const FORCE = process.argv.includes('--force');

interface AestheticsProduct {
  slug: string;
  name: string;
  imageUrl: string;
}

interface Product {
  id: number;
  name: string;
  image: string;
}

async function fetchSitemap(): Promise<AestheticsProduct[]> {
  console.log('Fetching sitemap…');
  const res = await axios.get<string>(SITEMAP_URL, { timeout: 30_000 });
  const xml = res.data;

  const products: AestheticsProduct[] = [];

  // Extract each <url> block
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    // Values are wrapped in CDATA: <loc><![CDATA[https://...]]></loc>
    const locMatch = block.match(/<loc>(?:<!\[CDATA\[)?(https:\/\/aesthetics-shop\.com\/product\/([^\]<]+?)\/??)(?:\]\]>)?<\/loc>/);
    const imgMatch = block.match(/<image:loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\]\s<]+?)\s*(?:\]\]>)?\s*<\/image:loc>/);

    if (!locMatch || !imgMatch) continue;

    const slug = locMatch[2].replace(/\/$/, '');
    // Derive readable name from slug
    const name = slug.replace(/-/g, ' ');
    const imageUrl = imgMatch[1];

    products.push({ slug, name, imageUrl });
  }

  console.log(`Parsed ${products.length} products from sitemap.`);
  return products;
}

async function downloadAndSave(imageUrl: string, destPath: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const buf = Buffer.from(res.data);
  await sharp(buf)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(destPath);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products;

  let aestheticsProducts: AestheticsProduct[];
  try {
    aestheticsProducts = await fetchSitemap();
  } catch (err) {
    console.error('Failed to fetch sitemap:', err);
    process.exit(1);
  }

  // Build normalised lookup
  const normMap: Array<{ norm: string; product: AestheticsProduct }> = aestheticsProducts.map(p => ({
    norm: normalise(p.name),
    product: p,
  }));

  const matched: string[] = [];
  const skipped: string[] = [];
  const unmatched: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    // Skip if already has image and not forcing
    if (!FORCE && p.image) {
      skipped.push(`#${p.id} ${p.name}`);
      process.stdout.write(`${prefix} – ${p.name} (has image, skipping)\n`);
      continue;
    }

    const normName = normalise(p.name);

    // Score all aesthetics-shop products
    const scored = normMap
      .map(({ norm, product }) => ({ score: scoreMatch(normName, norm), product }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      unmatched.push(`#${p.id} ${p.name}`);
      process.stdout.write(`${prefix} ✗ ${p.name} — no match\n`);
      continue;
    }

    const best = scored[0];
    const destPath = path.join(OUTPUT_DIR, `product-${p.id}.webp`);

    try {
      await downloadAndSave(best.product.imageUrl, destPath);
      data.products[i].image = `/images/products/product-${p.id}.webp`;
      matched.push(`#${p.id} ${p.name} ← ${best.product.name} (score: ${best.score})`);
      process.stdout.write(`${prefix} ✓ ${p.name} ← ${best.product.name}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`#${p.id} ${p.name}: ${msg}`);
      process.stdout.write(`${prefix} ✗ ${p.name} — download error: ${msg}\n`);
    }

    // Save progress every 10 products
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== MATCHED (${matched.length}) ===`,
    ...matched,
    '',
    `=== SKIPPED — had image (${skipped.length}) ===`,
    `(run with --force to overwrite)`,
    '',
    `=== UNMATCHED (${unmatched.length}) ===`,
    ...unmatched,
    '',
    `=== ERRORS (${errors.length}) ===`,
    ...errors,
  ].join('\n');

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log(`\nDone. Matched: ${matched.length}, Skipped: ${skipped.length}, Unmatched: ${unmatched.length}, Errors: ${errors.length}`);
  console.log(`Report: scripts/aesthetics-sync-report.txt`);
}

main();
