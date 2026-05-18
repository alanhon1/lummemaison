import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'extend-grouping-report.txt');

const STOPLIST = new Set(['PRODUCT', 'MIS', 'NEO', 'DR', 'DK', 'JBP', 'LINE']);
const MIN_PREFIX_LEN = 4;
const MIN_CLUSTER_SIZE = 2;

interface Product {
  id: number;
  name: string;
  categoryId: string;
  groupId?: string;
  variantLabel?: string;
}
interface DataFile { products: Product[] }

function leadingUpperTokens(name: string): string[] {
  // Strip parens and collapse whitespace; take tokens that are all-uppercase letters/digits.
  const clean = name.replace(/\(.*?\)/g, ' ').trim();
  const toks = clean.split(/\s+/);
  const out: string[] = [];
  for (const t of toks) {
    if (/^[A-Z0-9][A-Z0-9-]*$/.test(t) && t.length > 0) out.push(t);
    else break;
  }
  return out;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

  // Bucket un-grouped products by (categoryId, prefix).
  const buckets = new Map<string, Product[]>();
  for (const p of data.products) {
    if (p.groupId) continue;
    const toks = leadingUpperTokens(p.name);
    if (toks.length === 0) continue;
    const prefix = toks[0];
    if (prefix.length < MIN_PREFIX_LEN) continue;
    if (STOPLIST.has(prefix)) continue;
    const key = `${p.categoryId}::${prefix}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  // Existing groupIds (to avoid collisions).
  const existing = new Set(data.products.map(p => p.groupId).filter((g): g is string => !!g));

  const additions: Array<{ groupId: string; prefix: string; categoryId: string; members: Product[] }> = [];

  for (const [key, members] of buckets) {
    if (members.length < MIN_CLUSTER_SIZE) continue;
    const [categoryId, prefix] = key.split('::');
    let groupId = slugify(prefix);
    if (existing.has(groupId)) groupId = `${groupId}-${categoryId}`;
    additions.push({ groupId, prefix, categoryId, members });
    existing.add(groupId);
  }

  if (additions.length === 0) {
    console.log('No eligible un-grouped clusters found.');
    fs.writeFileSync(REPORT_PATH, 'No clusters.\n', 'utf8');
    return;
  }

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  // Apply.
  const changes: Array<{ id: number; name: string; groupId: string; variantLabel: string }> = [];
  for (const add of additions) {
    for (const p of add.members) {
      // variantLabel = trailing tokens after the shared prefix.
      const cleaned = p.name.replace(/\(.*?\)/g, ' ').trim();
      const toks = cleaned.split(/\s+/);
      // Drop the prefix token(s) shared by all members.
      let i = 0;
      while (i < toks.length && toks[i] === add.prefix) i++;
      const variantLabel = toks.slice(i).join(' ').trim() || add.prefix;
      p.groupId = add.groupId;
      p.variantLabel = variantLabel;
      changes.push({ id: p.id, name: p.name, groupId: add.groupId, variantLabel });
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Created ${additions.length} new group(s) across ${changes.length} products.`);

  const lines: string[] = [
    `Extend grouping — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `New groups: ${additions.length}`,
    `Affected products: ${changes.length}`,
    '',
  ];
  for (const add of additions) {
    lines.push(`Group "${add.groupId}" (prefix "${add.prefix}" in ${add.categoryId}, ${add.members.length} members):`);
    for (const m of add.members) {
      const variantLabel = changes.find(c => c.id === m.id)?.variantLabel ?? '';
      lines.push(`  #${m.id}  "${m.name}"  ->  variantLabel: "${variantLabel}"`);
    }
    lines.push('');
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
