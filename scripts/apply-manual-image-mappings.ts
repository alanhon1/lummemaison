/**
 * One-shot: apply hand-curated file → product-id mappings for missing finds
 * images whose filenames didn't survive the token-based auto-matcher.
 *
 * Each entry says "copy missing finds/<file> to public/images/products/product-<id>.<ext>
 * and set product.image accordingly". REPLACES the target file if present —
 * this is how we correct previous misassignments (e.g. exosia → EZCera).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');

interface Product {
  id: number;
  name: string;
  image: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

const MAPPINGS: ReadonlyArray<{ file: string; id: number; expectedName?: string }> = [
  { file: 'Power_Healer_Centre.webp',                                       id: 87,  expectedName: 'POWERHEALER' },
  { file: '_2_XSOME_2.png',                                                 id: 130, expectedName: '2XSOME' },
  { file: 'DERMAGEN EZCera Cream.avif',                                     id: 245, expectedName: 'DERMAGEN EZCera Cream' },
  { file: 'exosia 245 product.png',                                         id: 247, expectedName: 'EXOSIA Skin Booster Part 2' },
  { file: 'PLATINUM-FnB-box fnb.webp',                                      id: 304, expectedName: 'F&B' },
  { file: 'Re-N-Tox-200u-.jpg',                                             id: 325, expectedName: 'Re N Tox 200 units' },
  { file: 'Rentox100u.webp',                                                id: 326, expectedName: 'RE N TOX 100 units' },
  { file: 'maxyblueinj.png',                                                id: 383, expectedName: 'MAXYBLUE INJ' },
  { file: 'muchaine-500g.png',                                              id: 398, expectedName: 'MUCHCAINE' },
  { file: 'Muchcaine_30g.webp',                                             id: 399, expectedName: 'MUCHCAINE' },
  { file: 'JBP nano cannula 22G.png',                                       id: 413, expectedName: 'JBP nano cannula 22G' },
  { file: 'JBPNanoCannula25g_50mmSupplierAestheticsUKWholesale.jpg',        id: 414, expectedName: 'JBP nano cannula 25G' },
  { file: 'JBP nano cannula27g50mm.png',                                    id: 415, expectedName: 'JBP nano cannula 27G' },
  { file: 'JBP-Nano-Cannula-30G-25mm-–-Box-of-24-2.webp',              id: 416, expectedName: 'JBP nano cannula 30G' },
];

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`apply-manual-image-mappings: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const byId = new Map<number, Product>();
  for (const p of data.products) byId.set(p.id, p);

  let applied = 0;
  const missed: string[] = [];
  const nameMismatch: string[] = [];

  for (const rule of MAPPINGS) {
    const src = path.join(MISSING_FINDS, rule.file);
    if (!fs.existsSync(src)) {
      missed.push(`source missing: ${rule.file}`);
      continue;
    }
    const product = byId.get(rule.id);
    if (!product) {
      missed.push(`product id ${rule.id} not found`);
      continue;
    }
    if (rule.expectedName && product.name !== rule.expectedName) {
      nameMismatch.push(`id ${rule.id} expected "${rule.expectedName}" got "${product.name}"`);
    }
    const ext = path.extname(rule.file).toLowerCase();
    const targetName = `product-${rule.id}${ext}`;
    const targetPath = path.join(IMG_DIR, targetName);

    // Remove any other product-<id>.<otherExt> files first so we don't have stale leftovers.
    for (const e of ['.jpg', '.jpeg', '.png', '.webp', '.avif']) {
      const stale = path.join(IMG_DIR, `product-${rule.id}${e}`);
      if (e !== ext && fs.existsSync(stale)) fs.unlinkSync(stale);
    }

    fs.copyFileSync(src, targetPath);
    product.image = `/images/products/${targetName}`;
    applied++;
    console.log(`  #${rule.id} ${product.name.padEnd(40)} ← ${rule.file}`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`apply-manual-image-mappings: applied ${applied}/${MAPPINGS.length}`);
  if (nameMismatch.length > 0) {
    console.warn('Name mismatches (mapping still applied — verify):');
    for (const m of nameMismatch) console.warn(`  ${m}`);
  }
  if (missed.length > 0) {
    console.error('Missed:');
    for (const m of missed) console.error(`  ${m}`);
    process.exit(1);
  }
}

main();
