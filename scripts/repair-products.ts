/**
 * Repair pipeline: delete 16 specific products, match remaining products to
 * products.txt entries by category + ordinal, and fix names/specs/descriptions.
 *
 * NOT idempotent: ordinal matching assumes a fixed txt file and product list.
 * Re-running against a modified products.json will produce unexpected results.
 * Always use the backup from BACKUP_DIR if you need to revert.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseProductsTxt } from './lib/parse-products-txt';
import { matchByCategoryThenOrdinal, isBrokenName, type JsonProduct } from './lib/match-products';
import { formatReport, type ImageReport } from './lib/repair-report';

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
const DELETIONS: ReadonlyArray<{
  namePattern: RegExp;
  txtNamePattern?: RegExp;
  categoryId: string;
  label: string;
}> = [
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
  { namePattern: /^Product 292$/i,                     txtNamePattern: /^JOLLA PREMIUM OLIVE MASSAGE CREAM$/i,               categoryId: 'salon-grade', label: 'JOLLA PREMIUM OLIVE MASSAGE CREAM (placeholder)' },
  { namePattern: /^Fere$/i,                            txtNamePattern: /^Ferex inj$/i,                                       categoryId: 'injections',  label: 'Ferex inj' },
  { namePattern: /^ARGININE\s+INJ\./i,                 categoryId: 'injections',  label: 'ARGININE INJ.' },
  { namePattern: /^Product 406$/i,                     txtNamePattern: /^REJUVE Inj\.?$/i,                                   categoryId: 'placental-therapy', label: 'REJUVE Inj. (placeholder)' },
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
  for (const [, members] of groupCounts) {
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

const NUMBERED_RE = /(\d+)\s*product/i;

interface ValidationFailure { kind: string; detail: string }

function validate(data: { products: JsonProduct[]; categories: Array<{ id: string }> }): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  // 1. Every category has at least one product.
  for (const cat of data.categories) {
    const n = data.products.filter(p => p.categoryId === cat.id).length;
    if (n === 0) failures.push({ kind: 'empty-category', detail: cat.id });
  }

  // 2. No surviving broken-name patterns.
  for (const p of data.products) {
    if (isBrokenName(p.name)) failures.push({ kind: 'broken-name', detail: `#${p.id} ${p.name}` });
  }

  // 3. Deletion targets are absent.
  for (const rule of DELETIONS) {
    if (data.products.some(p => p.categoryId === rule.categoryId && rule.namePattern.test(p.name))) {
      failures.push({ kind: 'undeleted', detail: rule.label });
    }
  }

  // 4. Every groupId has either 0 or >=2 members.
  const groups = new Map<string, number>();
  for (const p of data.products) {
    const gid = p.groupId as string | undefined;
    if (gid) groups.set(gid, (groups.get(gid) ?? 0) + 1);
  }
  for (const [gid, n] of groups) {
    if (n < 2) failures.push({ kind: 'orphan-group', detail: `${gid} has ${n} member(s)` });
  }

  return failures;
}

function mapImages(products: JsonProduct[]): ImageReport {
  const autoMapped: ImageReport['autoMapped'] = [];
  const needsManual: ImageReport['needsManual'] = [];
  const byId = new Map<number, JsonProduct>();
  for (const p of products) byId.set(p.id, p);

  if (!fs.existsSync(MISSING_FINDS)) return { autoMapped, needsManual };
  const files = fs.readdirSync(MISSING_FINDS).filter(f => !f.startsWith('.'));

  for (const file of files) {
    const src = path.join(MISSING_FINDS, file);
    if (!fs.statSync(src).isFile()) continue;
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) continue;

    const numMatch = NUMBERED_RE.exec(file);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      const product = byId.get(id);
      if (!product) continue;            // deleted or out of range
      const targetName = `product-${id}${ext}`;
      const targetPath = path.join(IMG_DIR, targetName);
      const existing = product.image as string | undefined;
      const targetExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
      if (!existing) {
        if (!targetExists) {
          fs.copyFileSync(src, targetPath);
        }
        product.image = `/images/products/${targetName}`;
        autoMapped.push({ file, productId: id, targetPath: product.image as string });
      }
      continue;
    }

    // No number — rank by simple token-overlap score.
    const stem = file.replace(ext, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const tokens = new Set(stem.split(' ').filter(t => t.length >= 3));
    const scored = products
      .filter(p => !(p.image as string | undefined))
      .map(p => {
        const nameTokens = new Set(String(p.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length >= 3));
        let score = 0;
        for (const t of tokens) if (nameTokens.has(t)) score++;
        return { id: p.id, name: p.name as string, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    needsManual.push({ file, candidates: scored });
  }

  return { autoMapped, needsManual };
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

  // Defensive: drop products.txt entries that correspond to deletions, so they
  // don't leak into ordinal pairing and corrupt innocent products.
  const filteredTxt = txt.filter(e => !DELETIONS.some(d => {
    if (d.categoryId !== e.categoryId) return false;
    const pattern = d.txtNamePattern ?? d.namePattern;
    return pattern.test(e.name);
  }));
  console.log(`repair-products: filtered ${txt.length - filteredTxt.length} txt entries matching deletion rules`);

  const result = matchByCategoryThenOrdinal(data.products, filteredTxt);

  const counters = applyRewrites(result.matches);
  counters.groupCleanup = cleanupOrphanedGroups(data.products);

  const imageReport = mapImages(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`repair-products: wrote ${data.products.length} products (was ${before})`);
  console.log(`  name/spec/desc fix counters: name=${counters.nameFixes} spec=${counters.specFixes} desc=${counters.descRegenerated} groups=${counters.groupCleanup}`);
  console.log(`  images auto-mapped: ${imageReport.autoMapped.length}`);
  console.log(`  images needing manual mapping: ${imageReport.needsManual.length}`);

  const reportText = formatReport(imageReport, result.unmatchedProducts);
  fs.writeFileSync(REPORT_PATH, reportText, 'utf8');
  console.log(`repair-products: report → ${REPORT_PATH}`);

  const failures = validate(data as never);
  if (failures.length > 0) {
    console.error(`repair-products: ${failures.length} validation failure(s):`);
    for (const f of failures) console.error(`  [${f.kind}] ${f.detail}`);
    process.exit(2);
  }
  console.log('repair-products: validation passed');
}

main();
