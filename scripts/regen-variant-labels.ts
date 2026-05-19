/**
 * One-shot pass: for every product group (shared groupId), rewrite
 * `variantLabel` so it visibly distinguishes variants in the dropdown.
 *
 * Strategy per group:
 *   1. If every variant's `name` is unique within the group → variantLabel = name.
 *   2. Else, try to extract a unique label per variant from `specification`:
 *      size patterns first, then concentration %, then count units.
 *   3. If none of the three pattern families produces a fully unique set,
 *      fall back to "Variant N" labels and report the group.
 *   4. True duplicates (same name + same spec) are reported, not modified.
 *
 * Also backfills `groupImage`: if a group has any variant with a non-empty
 * `image`, copy that image into `groupImage` for every variant in the group.
 *
 * Idempotent — running on clean data is a no-op aside from a fresh backup.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'regen-variant-labels-report.txt');

interface Product {
  id: number;
  name: string;
  specification: string;
  groupId?: string;
  variantLabel?: string;
  groupImage?: string;
  image: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface Change { id: number; before: string; after: string }
interface DuplicateGroup { groupId: string; ids: number[]; name: string; spec: string }
interface FallbackGroup { groupId: string; ids: number[] }
interface ImageFilled { groupId: string; ids: number[]; image: string }

interface Report {
  changed: Change[];
  fallback: FallbackGroup[];
  duplicates: DuplicateGroup[];
  imageFilled: ImageFilled[];
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(mL|ml|g|mg|cc|kg|oz|L)\b/i;
const CONC_RE = /(\d+(?:\.\d+)?)\s*%/;
const COUNT_RE = /(?:x\s*)?(\d+)\s*(units?|U|IU|vials?|syr|syringes?|ampoules?|tabs?|sheets?|ea|pcs)\b/i;

function normaliseUnit(u: string): string {
  const lower = u.toLowerCase();
  if (lower === 'ml') return 'mL';
  if (lower === 'l') return 'L';
  return lower;
}

function extractSize(spec: string): string | null {
  const m = SIZE_RE.exec(spec);
  return m ? `${m[1]}${normaliseUnit(m[2])}` : null;
}

function extractConc(spec: string): string | null {
  const m = CONC_RE.exec(spec);
  return m ? `${m[1]}%` : null;
}

function extractCount(spec: string): string | null {
  const m = COUNT_RE.exec(spec);
  if (!m) return null;
  const unit = m[2].toLowerCase().replace(/s$/, '');
  return `${m[1]} ${unit}`;
}

type Extractor = (spec: string) => string | null;
const EXTRACTORS: Array<{ key: 'size' | 'conc' | 'count'; fn: Extractor }> = [
  { key: 'size',  fn: extractSize },
  { key: 'conc',  fn: extractConc },
  { key: 'count', fn: extractCount },
];

function resolveGroup(
  members: Product[],
): { labels: string[]; via: 'unique-name' | 'size' | 'conc' | 'count' | 'fallback' | 'duplicate' } {
  if (members.length === 0) return { labels: [], via: 'fallback' };

  const names = members.map(p => p.name);
  if (new Set(names).size === names.length) {
    return { labels: names, via: 'unique-name' };
  }

  for (const ex of EXTRACTORS) {
    const extracted = members.map(m => ex.fn(m.specification || ''));
    if (extracted.every(x => x !== null) && new Set(extracted).size === extracted.length) {
      return { labels: extracted as string[], via: ex.key };
    }
  }

  const specs = members.map(p => p.specification || '');
  const allSameName = new Set(names).size === 1;
  const allSameSpec = new Set(specs).size === 1;
  if (allSameName && allSameSpec) {
    return { labels: members.map(p => p.variantLabel ?? p.name), via: 'duplicate' };
  }

  return { labels: members.map((_, i) => `Variant ${i + 1}`), via: 'fallback' };
}

function applyLabels(byGroup: Map<string, Product[]>, report: Report): void {
  for (const [groupId, members] of byGroup) {
    const { labels, via } = resolveGroup(members);

    if (via === 'duplicate') {
      report.duplicates.push({
        groupId,
        ids: members.map(m => m.id),
        name: members[0].name,
        spec: members[0].specification ?? '',
      });
      continue;
    }

    if (via === 'fallback') {
      report.fallback.push({ groupId, ids: members.map(m => m.id) });
    }

    for (let i = 0; i < members.length; i++) {
      const before = members[i].variantLabel ?? '';
      const after = labels[i];
      if (before !== after) {
        members[i].variantLabel = after;
        report.changed.push({ id: members[i].id, before, after });
      }
    }
  }
}

function backfillGroupImages(byGroup: Map<string, Product[]>, report: Report): void {
  for (const [groupId, members] of byGroup) {
    const firstImage = members.find(m => m.image && m.image.length > 0)?.image;
    if (!firstImage) continue;
    const filled: number[] = [];
    for (const m of members) {
      if ((m.groupImage ?? '') !== firstImage) {
        m.groupImage = firstImage;
        filled.push(m.id);
      }
    }
    if (filled.length > 0) {
      report.imageFilled.push({ groupId, ids: filled, image: firstImage });
    }
  }
}

function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# regen-variant-labels report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Changed labels (${r.changed.length})`);
  for (const c of r.changed) lines.push(`  #${c.id}  "${c.before}" → "${c.after}"`);
  lines.push('');
  lines.push(`## Fallback "Variant N" groups (${r.fallback.length})`);
  for (const g of r.fallback) lines.push(`  group=${g.groupId}  ids=${g.ids.join(',')}`);
  lines.push('');
  lines.push(`## True duplicates — needs manual review (${r.duplicates.length})`);
  for (const d of r.duplicates) {
    lines.push(`  group=${d.groupId}  ids=${d.ids.join(',')}  name="${d.name}"  spec="${d.spec}"`);
  }
  lines.push('');
  lines.push(`## groupImage filled (${r.imageFilled.length})`);
  for (const i of r.imageFilled) lines.push(`  group=${i.groupId}  image=${i.image}  ids=${i.ids.join(',')}`);
  return lines.join('\n') + '\n';
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`regen-variant-labels: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }

  const report: Report = { changed: [], fallback: [], duplicates: [], imageFilled: [] };
  applyLabels(byGroup, report);
  backfillGroupImages(byGroup, report);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');

  console.log(`regen-variant-labels: groups=${byGroup.size} changed-labels=${report.changed.length} fallback=${report.fallback.length} duplicates=${report.duplicates.length} groupImage-filled=${report.imageFilled.length}`);
  console.log(`regen-variant-labels: report → ${REPORT_PATH}`);
}

main();
