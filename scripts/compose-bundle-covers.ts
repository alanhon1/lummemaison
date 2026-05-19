/**
 * Compose 800x800 webp bundle cover images from variant product images.
 * Updates each member's groupImage to the new bundle file.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const PRODUCTS_IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const BUNDLES_IMG_DIR = path.join(ROOT, 'public', 'images', 'bundles');
const PLACEHOLDER = path.join(BUNDLES_IMG_DIR, '_placeholder.webp');
const REPORT_PATH = path.join(ROOT, 'scripts', 'compose-bundle-covers-report.txt');

const CANVAS = 800;

interface Product {
  id: number;
  name: string;
  groupId?: string;
  image: string;
  groupImage?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function gridFor(n: number): { rows: number; cols: number; take: number } {
  if (n <= 1) return { rows: 1, cols: 1, take: 1 };
  if (n === 2) return { rows: 1, cols: 2, take: 2 };
  if (n <= 4) return { rows: 2, cols: 2, take: n };
  if (n <= 6) return { rows: 2, cols: 3, take: n };
  return { rows: 3, cols: 3, take: Math.min(9, n) };
}

async function ensurePlaceholder(): Promise<void> {
  if (fs.existsSync(PLACEHOLDER)) return;
  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: '#e5e5e5' },
  })
    .webp({ quality: 80 })
    .toFile(PLACEHOLDER);
}

async function buildCover(groupId: string, members: Product[]): Promise<{ outputPath: string; usedPlaceholders: number }> {
  const { rows, cols, take } = gridFor(members.length);
  const cellW = Math.floor(CANVAS / cols);
  const cellH = Math.floor(CANVAS / rows);

  const composites: sharp.OverlayOptions[] = [];
  let usedPlaceholders = 0;

  for (let i = 0; i < take; i++) {
    const m = members[i];
    let srcAbs: string;
    if (m.image && m.image.startsWith('/images/products/')) {
      srcAbs = path.join(ROOT, 'public', m.image);
    } else {
      srcAbs = PLACEHOLDER;
    }
    if (!fs.existsSync(srcAbs) || fs.statSync(srcAbs).size === 0) {
      srcAbs = PLACEHOLDER;
      usedPlaceholders++;
    }

    const cellBuf = await sharp(srcAbs)
      .resize(cellW, cellH, { fit: 'inside', background: '#ffffff' })
      .extend({
        top: 0, bottom: 0, left: 0, right: 0,
        background: '#ffffff',
      })
      .resize(cellW, cellH, { fit: 'contain', background: '#ffffff' })
      .toBuffer();

    const left = (i % cols) * cellW;
    const top = Math.floor(i / cols) * cellH;
    composites.push({ input: cellBuf, left, top });
  }

  const outputName = `bundle-${groupId}.webp`;
  const outputPath = path.join(BUNDLES_IMG_DIR, outputName);

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite(composites)
    .webp({ quality: 85 })
    .toFile(outputPath);

  return { outputPath: `/images/bundles/${outputName}`, usedPlaceholders };
}

async function main(): Promise<void> {
  const backupPath = backupDataFile();
  console.log(`compose-bundle-covers: backup -> ${backupPath}`);

  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await ensurePlaceholder();

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }

  const composed: Array<{ groupId: string; members: number; output: string; usedPlaceholders: number }> = [];
  const skipped: Array<{ groupId: string; reason: string }> = [];
  const errors: Array<{ groupId: string; error: string }> = [];

  for (const [groupId, members] of byGroup) {
    if (members.length < 2) {
      skipped.push({ groupId, reason: `only ${members.length} member(s)` });
      continue;
    }
    try {
      const { outputPath, usedPlaceholders } = await buildCover(groupId, members);
      for (const m of members) m.groupImage = outputPath;
      composed.push({ groupId, members: members.length, output: outputPath, usedPlaceholders });
    } catch (err) {
      errors.push({ groupId, error: (err as Error).message });
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# compose-bundle-covers report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`composed: ${composed.length}  skipped: ${skipped.length}  errors: ${errors.length}`);
  lines.push('');
  lines.push(`## Composed (${composed.length})`);
  for (const c of composed) {
    lines.push(`  ${c.groupId}  members=${c.members}  placeholders=${c.usedPlaceholders}  -> ${c.output}`);
  }
  lines.push('');
  lines.push(`## Skipped (${skipped.length})`);
  for (const s of skipped) lines.push(`  ${s.groupId}  --  ${s.reason}`);
  lines.push('');
  lines.push(`## Errors (${errors.length})`);
  for (const e of errors) lines.push(`  ${e.groupId}  --  ${e.error}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`compose-bundle-covers: composed=${composed.length} skipped=${skipped.length} errors=${errors.length}`);
  console.log(`compose-bundle-covers: report -> ${REPORT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
