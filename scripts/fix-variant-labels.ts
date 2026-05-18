import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'fix-variant-labels-report.txt');

interface Product {
  id: number;
  name: string;
  groupId?: string;
  variantLabel?: string;
}
interface DataFile { products: Product[] }

function disambiguate(name: string, existingLabel: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('NO LIDOCAINE')) return `${existingLabel} (NO LIDO)`;
  if (upper.includes('WITH LIDOCAINE')) return `${existingLabel} + LIDO`;
  if (upper.includes('LIDOCAINE')) return `${existingLabel} + LIDO`;
  if (upper.includes('PLUS')) return `${existingLabel} +`;
  if (upper.includes('IMPLANT')) return `${existingLabel} (IMPLANT)`;
  if (upper.includes('CE')) return `${existingLabel} (CE)`;
  if (upper.includes('MESO')) return `${existingLabel} (MESO)`;
  const tokens = name.trim().split(/\s+/);
  return `${existingLabel} (${tokens[tokens.length - 1]})`;
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const groups = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  const changes: Array<{ id: number; before: string; after: string; group: string }> = [];

  for (const [groupId, members] of groups) {
    const sorted = [...members].sort((a, b) => a.id - b.id);
    const seenLabels = new Map<string, Product>();
    for (const p of sorted) {
      const label = p.variantLabel ?? p.name;
      if (!seenLabels.has(label)) {
        seenLabels.set(label, p);
        continue;
      }
      let newLabel = disambiguate(p.name, label);
      let n = 2;
      while (seenLabels.has(newLabel)) {
        newLabel = `${label} (#${n++})`;
      }
      changes.push({ id: p.id, before: label, after: newLabel, group: groupId });
      p.variantLabel = newLabel;
      seenLabels.set(newLabel, p);
    }
  }

  if (changes.length === 0) {
    console.log('No variantLabel collisions found.');
    fs.writeFileSync(REPORT_PATH, 'No collisions.\n', 'utf8');
    return;
  }

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Disambiguated ${changes.length} variantLabel(s)`);

  const lines: string[] = [
    `Fix variant labels - ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Total changes: ${changes.length}`,
    '',
  ];
  for (const c of changes) {
    lines.push(`group "${c.group}" #${c.id}:  "${c.before}"  ->  "${c.after}"`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
