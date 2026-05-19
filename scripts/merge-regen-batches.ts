/**
 * Read every scripts/regen-batches/batch-*.json and apply the new
 * description / protocol fields to data/products.json.
 *
 * Skip rule: do NOT overwrite a field with an empty string. A subagent
 * that couldn't fill a field leaves it blank ("") in the JSON, and we
 * preserve the existing value in that case.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const BATCHES_DIR = path.join(ROOT, 'scripts', 'regen-batches');
const REPORT_PATH = path.join(ROOT, 'scripts', 'merge-regen-batches-report.txt');

interface Product {
  id: number;
  name: string;
  description: string;
  protocol?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface BatchRecord {
  id: number;
  description: string;
  protocol: string;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`merge-regen-batches: backup -> ${backupPath}`);

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const byId = new Map<number, Product>();
  for (const p of data.products) byId.set(p.id, p);

  const batchFiles = fs.readdirSync(BATCHES_DIR).filter(f => /^batch-\d+\.json$/.test(f)).sort();

  let descUpdates = 0;
  let protoUpdates = 0;
  let blankDesc = 0;
  let blankProto = 0;
  const missingIds: number[] = [];
  const perBatch: Array<{ file: string; records: number }> = [];

  for (const file of batchFiles) {
    const raw = fs.readFileSync(path.join(BATCHES_DIR, file), 'utf8').replace(/^﻿/, '');
    let records: BatchRecord[];
    try {
      records = JSON.parse(raw) as BatchRecord[];
    } catch (err) {
      console.warn(`failed to parse ${file}: ${(err as Error).message}`);
      continue;
    }
    perBatch.push({ file, records: records.length });

    for (const rec of records) {
      const p = byId.get(rec.id);
      if (!p) {
        missingIds.push(rec.id);
        continue;
      }
      if (typeof rec.description === 'string' && rec.description.trim().length > 0) {
        if (p.description !== rec.description) {
          p.description = rec.description;
          descUpdates++;
        }
      } else {
        blankDesc++;
      }
      if (typeof rec.protocol === 'string' && rec.protocol.trim().length > 0) {
        if (p.protocol !== rec.protocol) {
          p.protocol = rec.protocol;
          protoUpdates++;
        }
      } else {
        blankProto++;
      }
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# merge-regen-batches report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`description updates: ${descUpdates}`);
  lines.push(`protocol updates: ${protoUpdates}`);
  lines.push(`blank description in batch: ${blankDesc}`);
  lines.push(`blank protocol in batch: ${blankProto}`);
  lines.push(`missing IDs (in batch but not products.json): ${missingIds.length}`);
  lines.push('');
  lines.push('## Per-batch record counts');
  for (const b of perBatch) lines.push(`  ${b.file}  records=${b.records}`);
  if (missingIds.length > 0) {
    lines.push('');
    lines.push('## Missing IDs');
    lines.push(`  ${missingIds.join(', ')}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`merge-regen-batches: desc=${descUpdates} proto=${protoUpdates} blank-desc=${blankDesc} blank-proto=${blankProto} missing=${missingIds.length}`);
  console.log(`merge-regen-batches: report -> ${REPORT_PATH}`);
}

main();
