/**
 * Reads scripts/audit-results.json (produced by the Phase 1 vision-worker
 * subagents) and mutates data/products.json: any product whose status is
 * MISMATCH or UNCERTAIN has its `image` and `images` fields cleared so
 * Phase 2 can refill from a secondary source. Writes a timestamped backup
 * first and a human-readable report afterwards.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const RESULTS_FILE = path.join(process.cwd(), 'scripts', 'audit-results.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'audit-report.txt');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

type Status = 'CONFIRMED' | 'MISMATCH' | 'UNCERTAIN';
interface AuditResult { id: number; status: Status; reason: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
  images?: string[];
}
interface DataFile { categories: unknown; products: Product[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, ''));
  const results: AuditResult[] = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8').replace(/^﻿/, ''));
  const resultById = new Map(results.map(r => [r.id, r]));

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  let cleared = 0;
  for (const p of data.products) {
    const r = resultById.get(p.id);
    if (!r) continue;
    if (r.status === 'MISMATCH' || r.status === 'UNCERTAIN') {
      p.image = '';
      delete p.images;
      cleared++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Cleared ${cleared} mismatched/uncertain image(s) from data/products.json`);

  // Report
  const productById = new Map(data.products.map(p => [p.id, p]));
  const buckets: Record<Status, AuditResult[]> = { CONFIRMED: [], MISMATCH: [], UNCERTAIN: [] };
  for (const r of results) buckets[r.status].push(r);

  const lines: string[] = [];
  for (const status of ['MISMATCH', 'UNCERTAIN', 'CONFIRMED'] as const) {
    lines.push(`=== ${status} (${buckets[status].length}) ===`);
    for (const r of buckets[status]) {
      const p = productById.get(r.id);
      lines.push(`#${r.id}  ${p?.name ?? '???'}  →  ${r.reason}`);
    }
    lines.push('');
  }
  fs.writeFileSync(REPORT_FILE, lines.join('\n'), 'utf8');
  console.log(`Report written to ${REPORT_FILE}`);
}

main();
