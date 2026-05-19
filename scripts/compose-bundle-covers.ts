/**
 * Compose 800x800 webp bundle cover images from variant product images.
 * Uses the shared lib at @/lib/compose-bundle-cover so the admin PATCH
 * endpoint and this script share the same compositor.
 *
 * Updates each member's groupImage to the new bundle file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { composeBundleCover } from '../lib/compose-bundle-cover';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'compose-bundle-covers-report.txt');

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

async function main(): Promise<void> {
  const backupPath = backupDataFile();
  console.log(`compose-bundle-covers: backup -> ${backupPath}`);

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
      const { outputPath, usedPlaceholders } = await composeBundleCover(groupId, members);
      const versioned = `${outputPath}?v=${Date.now()}`;
      for (const m of members) m.groupImage = versioned;
      composed.push({ groupId, members: members.length, output: versioned, usedPlaceholders });
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
