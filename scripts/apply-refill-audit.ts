/**
 * Reads scripts/audit-batches/refill-result-{0,1}.json and clears the `image`
 * field for every product flagged MISMATCH or UNCERTAIN, then writes a
 * timestamped backup and a report at scripts/refill-audit-report.txt.
 *
 * One-shot cleanup after the post-refill vision pass.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'refill-audit-report.txt');
const BATCHES = [0, 1];

type Status = 'CONFIRMED' | 'MISMATCH' | 'UNCERTAIN';
interface AuditResult { id: number; status: Status; reason: string }
interface Product { id: number; name: string; image: string }
interface DataFile { products: Product[] }

function main(): void {
  const all: AuditResult[] = [];
  for (const n of BATCHES) {
    const p = path.join(ROOT, 'scripts', 'audit-batches', `refill-result-${n}.json`);
    if (!fs.existsSync(p)) {
      console.error(`Missing ${p}.`);
      process.exit(1);
    }
    all.push(...(JSON.parse(fs.readFileSync(p, 'utf8')) as AuditResult[]));
  }

  const byStatus = { CONFIRMED: 0, MISMATCH: 0, UNCERTAIN: 0 };
  for (const r of all) byStatus[r.status]++;
  console.log(`Loaded ${all.length} audit entries: ${JSON.stringify(byStatus)}`);

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const byId = new Map(data.products.map(p => [p.id, p]));

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `products-${stamp}.json`));
  console.log(`Backup written to data/backups/products-${stamp}.json`);

  const cleared: AuditResult[] = [];
  for (const r of all) {
    if (r.status === 'CONFIRMED') continue;
    const p = byId.get(r.id);
    if (p) {
      p.image = '';
      cleared.push(r);
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Cleared image field for ${cleared.length} product(s)`);

  const lines: string[] = [
    `Refill audit cleanup — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Audited: ${all.length}`,
    `  CONFIRMED: ${byStatus.CONFIRMED}`,
    `  MISMATCH:  ${byStatus.MISMATCH}`,
    `  UNCERTAIN: ${byStatus.UNCERTAIN}`,
    '',
    `Cleared: ${cleared.length}`,
    '',
  ];
  for (const r of cleared) {
    const p = byId.get(r.id);
    lines.push(`#${r.id}  ${p?.name ?? '???'}  →  [${r.status}]  ${r.reason}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
