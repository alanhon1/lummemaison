/**
 * One-shot consolidated catalogue data fix:
 *   - bundle merges (groupId assignments)
 *   - bundle splits (clear groupId / variantLabel / groupName / groupImage)
 *   - image clears (set image = "")
 *   - product delete (CURENEX SCULP 224)
 *   - image swaps (exchange image fields, no file moves)
 *   - manual missing-finds mappings (copy file + set image)
 *   - CURENEX 215-226 explicit variant labels
 *
 * NOT idempotent: the delete + swap steps would not no-op on re-run.
 * Always run against a clean baseline; the script writes a timestamped
 * backup before mutating.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'catalogue-fixes-report.txt');

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  variantLabel?: string;
  groupName?: string;
  groupImage?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface Report {
  merged: Array<{ id: number; from: string; to: string }>;
  split: Array<{ id: number; from: string }>;
  imageCleared: Array<{ id: number; was: string }>;
  deleted: Array<{ id: number; name: string }>;
  swapped: Array<{ a: number; b: number; aImage: string; bImage: string }>;
  manualMapped: Array<{ file: string; id: number; targetPath: string }>;
  manualSkipped: Array<{ file: string; id: number; reason: string }>;
  curenexLabels: Array<{ id: number; label: string }>;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

// --- Bundle merges -----------------------------------------------------------

const BUNDLE_MERGES: ReadonlyArray<{ ids: readonly number[]; groupId: string }> = [
  { ids: [20, 21, 22, 23, 24],                          groupId: 'neuramis' },
  { ids: [38, 39, 40],                                  groupId: 'youthfill' },
  { ids: [44],                                          groupId: 'celosome' },
  { ids: [51, 52, 53, 54],                              groupId: 'chaeum' },
  { ids: [228, 229, 230, 231],                          groupId: 'dermagen-dermagen' },
  { ids: [323, 324],                                    groupId: 'meditoxin' },
  { ids: [325, 326],                                    groupId: 're-n-tox' },
];

function applyMerges(byId: Map<number, Product>, report: Report): void {
  for (const rule of BUNDLE_MERGES) {
    for (const id of rule.ids) {
      const p = byId.get(id);
      if (!p) continue;
      const before = (p.groupId ?? '') as string;
      if (before === rule.groupId) continue;
      p.groupId = rule.groupId;
      report.merged.push({ id, from: before || '(none)', to: rule.groupId });
    }
  }
}

// --- Bundle splits -----------------------------------------------------------

const BUNDLE_SPLITS: ReadonlyArray<number> = [89, 66, 103, 106, 387, 389];

function applySplits(byId: Map<number, Product>, report: Report): void {
  for (const id of BUNDLE_SPLITS) {
    const p = byId.get(id);
    if (!p) continue;
    if (!p.groupId) continue;
    const before = p.groupId as string;
    delete p.groupId;
    delete p.variantLabel;
    delete p.groupName;
    delete p.groupImage;
    report.split.push({ id, from: before });
  }
}

// --- Image clears ------------------------------------------------------------

const IMAGE_CLEARS: ReadonlyArray<number> = [
  3, 4, 17, 84, 216, 348, 349, 387, 408, 409, 410, 411,
];

function applyImageClears(byId: Map<number, Product>, report: Report): void {
  for (const id of IMAGE_CLEARS) {
    const p = byId.get(id);
    if (!p) continue;
    const was = p.image ?? '';
    if (!was) continue;
    p.image = '';
    report.imageCleared.push({ id, was });
  }
}

// --- Delete CURENEX SCULP 224 ------------------------------------------------

function applyDeletions(data: DataFile, byId: Map<number, Product>, report: Report): void {
  const target = byId.get(224);
  if (!target) return;
  if (!/^CURENEX\s+SCULP$/i.test(target.name)) {
    console.warn(`catalogue-fixes: id 224 name unexpected ("${target.name}") - skipping delete`);
    return;
  }
  const idx = data.products.findIndex(p => p.id === 224);
  if (idx >= 0) {
    data.products.splice(idx, 1);
    byId.delete(224);
    report.deleted.push({ id: 224, name: target.name });
  }
}

// --- Image swaps -------------------------------------------------------------

const IMAGE_SWAPS: ReadonlyArray<[number, number]> = [
  [21, 22],
  [66, 103],
  [119, 121],
];

function applyImageSwaps(byId: Map<number, Product>, report: Report): void {
  for (const [a, b] of IMAGE_SWAPS) {
    const pa = byId.get(a);
    const pb = byId.get(b);
    if (!pa || !pb) continue;
    const aImage = pa.image ?? '';
    const bImage = pb.image ?? '';
    if (aImage === bImage) continue;
    pa.image = bImage;
    pb.image = aImage;
    report.swapped.push({ a, b, aImage: bImage, bImage: aImage });
  }
}

// --- Manual missing-finds mappings ------------------------------------------

const MANUAL_MAPPINGS: ReadonlyArray<{ file: string; id: number; expectedName?: string }> = [
  { file: 'Adimis-Body-Filler.jpg',                                                                              id: 67,  expectedName: 'AdiMis' },
  { file: 'maxy-fill-2.webp',                                                                                    id: 69,  expectedName: 'MAXY FILL' },
  { file: 'ULTRAGEN_X_Middle.webp',                                                                              id: 84,  expectedName: 'ULTRA GEN' },
  { file: 'neuramis light(meso).jpg',                                                                            id: 20,  expectedName: 'NEURAMIS LIGHT (MESO)' },
  { file: 'Neuramis-Lidocain.jpg',                                                                               id: 21,  expectedName: 'NEURAMIS' },
  { file: 'neuramis deep lido.png',                                                                              id: 23,  expectedName: 'NEURAMIS DEEP WITH LIDOCAINE' },
  { file: 'REGENOVUE_SUB_Q.webp',                                                                                id: 5,   expectedName: 'REGENOVUE SUB-Q (CE)' },
  { file: 'eng_pl_Regenovue-Fine-Plus-1-1-ml-CE-94_1_1.jpg',                                                     id: 6,   expectedName: 'REGENOVUE FINE PLUS (CE)' },
  { file: 'eng_pl_Regenovue-Deep-Plus-1-1-ml-CE-97_1_1.jpg',                                                     id: 7,   expectedName: 'REGENOVUE DEEP PLUS (CE)' },
  { file: 'eng_pl_Regenovue-Sub-Q-Plus-1-1-ml-CE-96_1_1.jpg',                                                    id: 8,   expectedName: 'REGENOVUE SUB-Q PLUS (CE)' },
  { file: 'curenex-rejuvenating-cream-for-day-and-night-with-pdrn-4.06-fl-oz-getglowing-skincare__88885.jpg',    id: 218, expectedName: 'CURENEX REJUVENATING CREAM' },
  { file: 'dermagen-well.jpg',                                                                                   id: 233 },
  { file: 'dermagen urea cream deep.jpg',                                                                        id: 235 },
  { file: 'dermagen lunatox (not lunato).jpg',                                                                   id: 239 },
  { file: 'PEPTICULE ULTIMATE REJUVENATION CREAM.webp',                                                          id: 264 },
  { file: 'PEPTICULE ULTIMATE REJUVENATION SERUM.png',                                                           id: 265 },
  { file: 'vns lipolyticsolution vns fat.jpg',                                                                   id: 307, expectedName: 'VNS' },
  { file: 'meditoxin-200u-botox-injections.jpg',                                                                 id: 324 },
  { file: 'MASI Injection 10% (Magnesium.jpg',                                                                   id: 338 },
  { file: 'CHIOCTOCIN_INJ_2.jpg',                                                                                id: 386 },
  { file: 'Zinc S Inj..jpg',                                                                                     id: 382 },
  { file: 'CORETOX_100U___MEDYTOX__2.png',                                                                       id: 334 },
  { file: 'multivita-lyophilized.jpg',                                                                           id: 372 },
  { file: 'regenovue-aqua-shine-plus-getglowing-skincare__30485.jpg',                                            id: 91 },
  { file: 'regenovue-aqua-shine-silver-9ml-getglowing-skincare__07632.jpg',                                      id: 92 },
  { file: 'regenovue-pn-non.jpg',                                                                                id: 90 },
  { file: 'revolax-sub-q-with-lidocaine-12.webp',                                                                id: 28 },
  { file: 'vanhalla niacinamide skin tone balance.webp',                                                         id: 195 },
  { file: 'elaxenpllaaestheticsukforskin.jpg',                                                                   id: 101 },
];

function applyManualMappings(byId: Map<number, Product>, report: Report): void {
  for (const rule of MANUAL_MAPPINGS) {
    const src = path.join(MISSING_FINDS, rule.file);
    if (!fs.existsSync(src)) {
      report.manualSkipped.push({ file: rule.file, id: rule.id, reason: 'source file missing' });
      continue;
    }
    const product = byId.get(rule.id);
    if (!product) {
      report.manualSkipped.push({ file: rule.file, id: rule.id, reason: 'product id not found' });
      continue;
    }
    const ext = path.extname(rule.file).toLowerCase();
    const targetName = `product-${rule.id}${ext}`;
    const targetPath = path.join(IMG_DIR, targetName);

    for (const e of ['.jpg', '.jpeg', '.png', '.webp', '.avif']) {
      const stale = path.join(IMG_DIR, `product-${rule.id}${e}`);
      if (e !== ext && fs.existsSync(stale)) fs.unlinkSync(stale);
    }

    fs.copyFileSync(src, targetPath);
    product.image = `/images/products/${targetName}`;
    report.manualMapped.push({ file: rule.file, id: rule.id, targetPath: product.image });
  }
}

// --- CURENEX variant labels --------------------------------------------------

const CURENEX_LABELS: ReadonlyArray<{ id: number; label: string }> = [
  { id: 215, label: 'SCULP (PLLA)' },
  { id: 216, label: 'PDRN, Multi' },
  { id: 217, label: 'DAILY CARE SKINBOOSTER (SERUM)' },
  { id: 218, label: 'REJUVENATING CREAM' },
  { id: 219, label: 'HYDRATING CLEANSER' },
  { id: 220, label: 'LIPO (FACE AND BODY)' },
  { id: 221, label: 'REJUVENATING MASK' },
  { id: 222, label: 'EXO BRIGHTENING CREAM' },
  { id: 223, label: 'EYE PN' },
  { id: 225, label: 'SNOW PEEL' },
  { id: 226, label: 'SHEER SUNSCREEN' },
];

function applyCurenexLabels(byId: Map<number, Product>, report: Report): void {
  for (const rule of CURENEX_LABELS) {
    const p = byId.get(rule.id);
    if (!p) continue;
    if (p.variantLabel === rule.label) continue;
    p.variantLabel = rule.label;
    report.curenexLabels.push({ id: rule.id, label: rule.label });
  }
}

// --- Report formatter --------------------------------------------------------

function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# catalogue-fixes report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Bundle merges (${r.merged.length})`);
  for (const m of r.merged) lines.push(`  #${m.id}  ${m.from} -> ${m.to}`);
  lines.push('');
  lines.push(`## Bundle splits (${r.split.length})`);
  for (const s of r.split) lines.push(`  #${s.id}  cleared from ${s.from}`);
  lines.push('');
  lines.push(`## Image cleared (${r.imageCleared.length})`);
  for (const c of r.imageCleared) lines.push(`  #${c.id}  was=${c.was}`);
  lines.push('');
  lines.push(`## Deleted (${r.deleted.length})`);
  for (const d of r.deleted) lines.push(`  #${d.id}  ${d.name}`);
  lines.push('');
  lines.push(`## Image swaps (${r.swapped.length})`);
  for (const s of r.swapped) lines.push(`  #${s.a} <-> #${s.b}  ${s.aImage}  /  ${s.bImage}`);
  lines.push('');
  lines.push(`## Manual missing-finds mappings (${r.manualMapped.length})`);
  for (const m of r.manualMapped) lines.push(`  ${m.file}  ->  #${m.id}  ->  ${m.targetPath}`);
  lines.push('');
  lines.push(`## Manual mappings skipped (${r.manualSkipped.length})`);
  for (const s of r.manualSkipped) lines.push(`  ${s.file}  id=${s.id}  reason=${s.reason}`);
  lines.push('');
  lines.push(`## CURENEX labels (${r.curenexLabels.length})`);
  for (const c of r.curenexLabels) lines.push(`  #${c.id}  ${c.label}`);
  return lines.join('\n') + '\n';
}

// --- Main pipeline -----------------------------------------------------------

function main(): void {
  console.log('catalogue-fixes: starting');
  const backupPath = backupDataFile();
  console.log(`catalogue-fixes: backup -> ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const byId = new Map<number, Product>();
  for (const p of data.products) byId.set(p.id, p);

  const report: Report = {
    merged: [], split: [], imageCleared: [], deleted: [],
    swapped: [], manualMapped: [], manualSkipped: [], curenexLabels: [],
  };

  applyMerges(byId, report);
  applySplits(byId, report);
  applyImageClears(byId, report);
  applyDeletions(data, byId, report);
  applyImageSwaps(byId, report);
  applyManualMappings(byId, report);
  applyCurenexLabels(byId, report);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');

  console.log(`catalogue-fixes: merged=${report.merged.length} split=${report.split.length} image-cleared=${report.imageCleared.length} deleted=${report.deleted.length} swapped=${report.swapped.length} manual-mapped=${report.manualMapped.length} manual-skipped=${report.manualSkipped.length} curenex-labels=${report.curenexLabels.length}`);
  console.log(`catalogue-fixes: wrote ${data.products.length} products`);
  console.log(`catalogue-fixes: report -> ${REPORT_PATH}`);
}

main();
