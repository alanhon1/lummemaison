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

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

// Deletions resolved by name + categoryId so off-by-one ID drift in earlier
// runs doesn't corrupt the list. Each entry must uniquely identify ONE product.
const DELETIONS: ReadonlyArray<{ namePattern: RegExp; categoryId: string; label: string }> = [
  // TESORO from fillers (all 7 — keep TESORO COLLAGEN in mesotherapy)
  { namePattern: /^TESORO\s+FINE\s+PLUS$/i,            categoryId: 'fillers',     label: 'TESORO FINE PLUS' },
  { namePattern: /^TESORO\s+DEEP\s+PLUS$/i,            categoryId: 'fillers',     label: 'TESORO DEEP PLUS' },
  { namePattern: /^TESORO\s+SUB\s*-?\s*Q\s+PLUS$/i,    categoryId: 'fillers',     label: 'TESORO SUB-Q PLUS' },
  { namePattern: /^TESORO\s+IMPLANT\s+WITH\s+LIDOCAINE$/i, categoryId: 'fillers', label: 'TESORO IMPLANT WITH LIDOCAINE' },
  { namePattern: /^TESORO\s+FINE$/i,                   categoryId: 'fillers',     label: 'TESORO FINE' },
  { namePattern: /^TESORO\s+DEEP$/i,                   categoryId: 'fillers',     label: 'TESORO DEEP' },
  { namePattern: /^TESORO\s+SUB\s*-?\s*Q$/i,           categoryId: 'fillers',     label: 'TESORO SUB-Q' },
  // HANHEAL from mesotherapy
  { namePattern: /^HANHEAL\s+HA\s+AMPOULE$/i,          categoryId: 'mesotherapy', label: 'HANHEAL HA AMPOULE' },
  { namePattern: /^HANHEAL\s+PDRN\s+BOOSTER$/i,        categoryId: 'mesotherapy', label: 'HANHEAL PDRN BOOSTER' },
  // Item 6 — no-image products: match by id since current names may be mangled
  // (FINASTE RIDE, Fere, etc.). We re-key these to (categoryId, currentName-substring).
  { namePattern: /^FINASTE\s*RIDE/i,                   categoryId: 'hair-treatment', label: 'FINASTERIDE Tab. 1mg' },
  { namePattern: /^JOLLA\s+HIGH\s+FREQUENCY/i,         categoryId: 'salon-grade', label: 'JOLLA HIGH FREQUENCY MASSAGE CREAM' },
  { namePattern: /^Product 292$/i,                     categoryId: 'salon-grade', label: 'JOLLA PREMIUM OLIVE MASSAGE CREAM (placeholder)' },
  { namePattern: /^Fere$/i,                            categoryId: 'injections',  label: 'Ferex inj' },
  { namePattern: /^ARGININE\s+INJ\./i,                 categoryId: 'injections',  label: 'ARGININE INJ.' },
  { namePattern: /^Product 406$/i,                     categoryId: 'placental-therapy', label: 'REJUVE Inj. (placeholder)' },
  { namePattern: /^EVERLINE\s+MEZO\s+NEEDLE$/i,        categoryId: 'nano-needle-cannula', label: 'EVERLINE MEZO NEEDLE' },
];

function applyDeletions(products: JsonProduct[]): { kept: JsonProduct[]; deleted: JsonProduct[]; missed: string[] } {
  const deleted: JsonProduct[] = [];
  const missed: string[] = [];
  for (const rule of DELETIONS) {
    const idx = products.findIndex(p => p.categoryId === rule.categoryId && rule.namePattern.test(p.name));
    if (idx === -1) {
      missed.push(rule.label);
      continue;
    }
    deleted.push(products[idx]);
    products.splice(idx, 1);
  }
  return { kept: products, deleted, missed };
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`repair-products: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as { products: JsonProduct[]; categories: unknown[] };
  const before = data.products.length;

  const { deleted, missed } = applyDeletions(data.products);
  console.log(`repair-products: deleted ${deleted.length} of ${DELETIONS.length} targets (missed ${missed.length})`);
  for (const m of missed) console.log(`  MISS: ${m}`);

  const txt = parseProductsTxt(PRODUCTS_TXT);
  const result = matchByCategoryThenOrdinal(data.products, txt);
  console.log(`repair-products: ${data.products.length} products remaining (was ${before})`);
  console.log(`  matches: ${result.matches.length}, unmatched products: ${result.unmatchedProducts.length}, unmatched entries: ${result.unmatchedEntries.length}`);

  // No write yet — Task 5 wires it.
}

main();
