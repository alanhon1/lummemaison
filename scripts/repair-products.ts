import fs from 'node:fs';
import path from 'node:path';
import { parseProductsTxt } from './lib/parse-products-txt';
import { matchByCategoryThenOrdinal, type JsonProduct } from './lib/match-products';

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

  const txt = parseProductsTxt(PRODUCTS_TXT);
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as { products: JsonProduct[]; categories: unknown[] };
  const result = matchByCategoryThenOrdinal(data.products, txt);

  console.log(`repair-products: ${result.matches.length} matches`);
  console.log(`  unmatched products: ${result.unmatchedProducts.length}`);
  console.log(`  unmatched entries:  ${result.unmatchedEntries.length}`);
  for (const row of result.perCategoryReport) {
    console.log(`  ${row.categoryId.padEnd(28)} prods=${row.productCount} txt=${row.entryCount} matched=${row.matched}`);
  }
}

main();
