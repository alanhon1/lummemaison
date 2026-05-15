/**
 * Scrapes short product descriptions from aesthetics-shop.com and writes
 * them to data/products.json.
 *
 * Only processes products that have a groupId (matched to aesthetics-shop.com).
 * All products in the same group receive the same description.
 *
 * Usage:
 *   npx tsx scripts/scrape-descriptions.ts
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'descriptions-report.txt');
const DELAY_MS = 1500;

interface Product {
  id: number;
  name: string;
  groupId?: string;
  description: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchDescription(slug: string): Promise<string | null> {
  const url = `https://aesthetics-shop.com/product/${slug}/`;
  try {
    const res = await axios.get<string>(url, {
      timeout: 30_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
    });
    const $ = cheerio.load(res.data);

    // WooCommerce short description
    const short = $('.woocommerce-product-details__short-description').text().trim();
    if (short.length > 10) return short.slice(0, 300).trim();

    // First paragraph in product summary
    const para = $('.entry-summary p').first().text().trim();
    if (para.length > 10) return para.slice(0, 300).trim();

    // Product description tab
    const desc = $('.woocommerce-Tabs-panel--description p').first().text().trim();
    if (desc.length > 10) return desc.slice(0, 300).trim();

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  // Build set of unique slugs that need descriptions
  const slugSet = new Set<string>();
  for (const p of allProducts) {
    if (p.groupId) slugSet.add(p.groupId);
  }

  const slugs = Array.from(slugSet);
  console.log(`Fetching descriptions for ${slugs.length} unique slugs…`);

  const descMap = new Map<string, string>();
  const failed: string[] = [];
  const succeeded: string[] = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    process.stdout.write(`[${i + 1}/${slugs.length}] ${slug}… `);
    const desc = await fetchDescription(slug);
    if (desc) {
      descMap.set(slug, desc);
      process.stdout.write(`✓ (${desc.length} chars)\n`);
      succeeded.push(slug);
    } else {
      process.stdout.write('✗ not found\n');
      failed.push(slug);
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  // Write descriptions to all products in each group
  let updated = 0;
  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    if (p.groupId && descMap.has(p.groupId)) {
      allProducts[i].description = descMap.get(p.groupId)!;
      updated++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== DESCRIPTIONS FETCHED (${succeeded.length}) ===`,
    ...succeeded,
    '',
    `=== FAILED (${failed.length}) ===`,
    ...failed,
  ].join('\n');
  fs.writeFileSync(REPORT_FILE, report, 'utf8');

  console.log(`\nDone. Updated ${updated} products. Report: scripts/descriptions-report.txt`);
}

main();
