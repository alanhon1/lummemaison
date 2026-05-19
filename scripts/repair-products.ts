/**
 * One-shot data repair.
 *
 * Running this against an already-repaired data file aborts with a "missed N
 * deletions" error — that is by design. The DELETIONS list is what makes this
 * non-idempotent. To re-run, restore from a backup in data/backups/ first.
 */
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

interface RewriteCounters {
  nameFixes: number;
  specFixes: number;
  descRegenerated: number;
  groupCleanup: number;
}

function applyRewrites(
  matches: Array<{ product: JsonProduct; entry: { name: string; spec: string } }>,
): RewriteCounters {
  const counters: RewriteCounters = { nameFixes: 0, specFixes: 0, descRegenerated: 0, groupCleanup: 0 };

  for (const { product, entry } of matches) {
    const oldName = product.name;
    const oldSpec = product.specification;
    const nameChanged = oldName !== entry.name;
    const specChanged = entry.spec && entry.spec !== oldSpec;

    if (nameChanged) {
      product.name = entry.name;
      counters.nameFixes++;
    }
    if (specChanged) {
      product.specification = entry.spec;
      counters.specFixes++;
    }
    // Regenerate description only if name was wrong AND the old name appears in description.
    if (nameChanged && typeof product.description === 'string' && product.description.includes(oldName)) {
      product.description = `${entry.name} is a professional-use product distributed for licensed practitioners. Specification: ${entry.spec || oldSpec || 'on file'}.`;
      counters.descRegenerated++;
    }
  }

  return counters;
}

function cleanupOrphanedGroups(products: JsonProduct[]): number {
  const groupCounts = new Map<string, JsonProduct[]>();
  for (const p of products) {
    const gid = p.groupId as string | undefined;
    if (!gid) continue;
    const arr = groupCounts.get(gid) ?? [];
    arr.push(p);
    groupCounts.set(gid, arr);
  }
  let cleaned = 0;
  for (const [gid, members] of groupCounts) {
    if (members.length <= 1) {
      for (const m of members) {
        delete m.groupId;
        delete m.variantLabel;
        delete m.groupName;
        delete m.groupImage;
      }
      cleaned += members.length;
    }
  }
  return cleaned;
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`repair-products: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as { products: JsonProduct[]; categories: unknown[] };
  const before = data.products.length;

  const { deleted, missed } = applyDeletions(data.products);
  if (missed.length > 0) {
    console.error(`repair-products: ${missed.length} deletion target(s) not found, aborting before write:`);
    for (const m of missed) console.error(`  MISS: ${m}`);
    process.exit(1);
  }
  console.log(`repair-products: deleted ${deleted.length} products`);

  const txt = parseProductsTxt(PRODUCTS_TXT);
  const result = matchByCategoryThenOrdinal(data.products, txt);

  const counters = applyRewrites(result.matches);
  counters.groupCleanup = cleanupOrphanedGroups(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`repair-products: wrote ${data.products.length} products (was ${before})`);
  console.log(`  name fixes: ${counters.nameFixes}`);
  console.log(`  spec fixes: ${counters.specFixes}`);
  console.log(`  description regenerations: ${counters.descRegenerated}`);
  console.log(`  group cleanup (single-member groups flattened): ${counters.groupCleanup}`);
  console.log(`  unmatched products: ${result.unmatchedProducts.length}`);
  if (result.unmatchedProducts.length > 0) {
    for (const p of result.unmatchedProducts) console.log(`    UNMATCHED #${p.id} (${p.categoryId}): ${p.name}`);
  }
}

main();
