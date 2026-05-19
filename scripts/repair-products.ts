import fs from 'node:fs';
import path from 'node:path';
import { parseProductsTxt } from './lib/parse-products-txt';

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
  console.log(`repair-products: parsed ${txt.length} entries from products.txt`);
  const byCat = new Map<string, number>();
  for (const e of txt) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + 1);
  for (const [cat, n] of byCat) console.log(`  ${cat}: ${n}`);
}

main();
