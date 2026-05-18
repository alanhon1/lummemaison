/**
 * Reads scripts/enrich-batches/result-{N}.json files produced by content
 * subagents and merges the `description`/`indication`/`packaging`/`protocol`
 * fields into data/products.json. Backs up first, writes a report afterwards.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const BATCH_DIR = path.join(ROOT, 'scripts', 'enrich-batches');
const REPORT_PATH = path.join(ROOT, 'scripts', 'enrich-report.txt');

interface EnrichResult {
  id: number;
  description?: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
}
interface Product {
  id: number;
  name: string;
  description: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
}
interface DataFile { products: Product[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  if (!fs.existsSync(BATCH_DIR)) {
    console.error(`Missing ${BATCH_DIR}. Run enrich-prep first and have subagents write result files.`);
    process.exit(1);
  }

  const allResults: EnrichResult[] = [];
  const missing: number[] = [];
  for (let n = 0; n < 100; n++) {
    const p = path.join(BATCH_DIR, `result-${n}.json`);
    if (!fs.existsSync(p)) {
      // Check if batch-N exists; if it does but result-N doesn't, mark missing.
      if (fs.existsSync(path.join(BATCH_DIR, `batch-${n}.json`))) missing.push(n);
      else break;
      continue;
    }
    const arr = JSON.parse(fs.readFileSync(p, 'utf8')) as EnrichResult[];
    allResults.push(...arr);
  }

  if (missing.length > 0) {
    console.error(`Missing result files for batches: ${missing.join(', ')}.`);
    console.error('Aborting. Re-dispatch the missing batches and re-run.');
    process.exit(1);
  }

  console.log(`Loaded ${allResults.length} enrich results.`);

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const byId = new Map(data.products.map(p => [p.id, p]));

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  let touched = 0;
  const fieldsSet = { description: 0, indication: 0, packaging: 0, protocol: 0 };
  for (const r of allResults) {
    const p = byId.get(r.id);
    if (!p) continue;
    if (r.description) { p.description = r.description; fieldsSet.description++; }
    if (r.indication) { p.indication = r.indication; fieldsSet.indication++; }
    if (r.packaging) { p.packaging = r.packaging; fieldsSet.packaging++; }
    if (r.protocol) { p.protocol = r.protocol; fieldsSet.protocol++; }
    touched++;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${touched} product(s). Fields set:`, fieldsSet);

  const lines: string[] = [
    `Enrich apply — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Products updated: ${touched}`,
    `description set: ${fieldsSet.description}`,
    `indication set:  ${fieldsSet.indication}`,
    `packaging set:   ${fieldsSet.packaging}`,
    `protocol set:    ${fieldsSet.protocol}`,
    '',
  ];
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
