/**
 * One-shot pass: for every image in `missing finds/` whose filename does NOT
 * contain the `NNNproduct` numeric pattern, attempt to auto-map it to a
 * product whose first alphanumeric name token matches the file's first usable
 * token. Idempotent on the filesystem — never overwrites existing target files.
 *
 * Outcomes per file:
 *   - exactly-one matching product with empty `image` → copy + set image
 *   - multiple matches → ambiguous, report only
 *   - no matches → no-match, report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MISSING_FINDS = path.join(ROOT, 'missing finds');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'auto-map-name-images-report.txt');

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const NUMBERED_RE = /\d+\s*product/i;
const SPLIT_RE = /[-_ ()]+/;

interface Product {
  id: number;
  name: string;
  image: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface AutoMapped { file: string; productId: number; targetPath: string }
interface Ambiguous { file: string; token: string; candidates: Array<{ id: number; name: string }> }
interface NoMatch { file: string; token: string }
interface NoToken { file: string }

interface Report {
  autoMapped: AutoMapped[];
  ambiguous: Ambiguous[];
  noMatch: NoMatch[];
  noToken: NoToken[];
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function productKey(name: string): string {
  const m = /[a-z0-9]+/i.exec(name);
  return m ? m[0].toLowerCase() : '';
}

function fileKey(stem: string): string {
  const parts = stem.split(SPLIT_RE).filter(Boolean);
  for (const p of parts) {
    if (p.length >= 3) return p.toLowerCase();
  }
  return '';
}

function scanAndMap(products: Product[]): Report {
  const report: Report = { autoMapped: [], ambiguous: [], noMatch: [], noToken: [] };
  if (!fs.existsSync(MISSING_FINDS)) return report;

  const productIndex = new Map<string, Product[]>();
  for (const p of products) {
    const k = productKey(p.name);
    if (!k) continue;
    const list = productIndex.get(k) ?? [];
    list.push(p);
    productIndex.set(k, list);
  }

  const files = fs.readdirSync(MISSING_FINDS).filter(f => !f.startsWith('.'));
  for (const file of files) {
    const src = path.join(MISSING_FINDS, file);
    if (!fs.statSync(src).isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    if (!IMG_EXTS.has(ext)) continue;

    if (NUMBERED_RE.test(file)) continue;

    const stem = file.slice(0, file.length - path.extname(file).length);
    const token = fileKey(stem);
    if (!token) {
      report.noToken.push({ file });
      continue;
    }

    const candidates = (productIndex.get(token) ?? []).filter(p => !p.image);
    if (candidates.length === 0) {
      report.noMatch.push({ file, token });
      continue;
    }
    if (candidates.length > 1) {
      report.ambiguous.push({
        file,
        token,
        candidates: candidates.map(c => ({ id: c.id, name: c.name })),
      });
      continue;
    }

    const product = candidates[0];
    const targetName = `product-${product.id}${ext}`;
    const targetPath = path.join(IMG_DIR, targetName);
    const targetExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
    if (!targetExists) {
      fs.copyFileSync(src, targetPath);
    }
    product.image = `/images/products/${targetName}`;
    report.autoMapped.push({ file, productId: product.id, targetPath: product.image });
  }

  return report;
}

function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push('# auto-map-name-images report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Auto-mapped (${r.autoMapped.length})`);
  for (const x of r.autoMapped) lines.push(`  ${x.file}  →  #${x.productId}  →  ${x.targetPath}`);
  lines.push('');
  lines.push(`## Ambiguous — multiple candidates (${r.ambiguous.length})`);
  for (const x of r.ambiguous) {
    lines.push(`  ${x.file}  (token=${x.token})`);
    for (const c of x.candidates) lines.push(`     candidate #${c.id} ${c.name}`);
  }
  lines.push('');
  lines.push(`## No match (${r.noMatch.length})`);
  for (const x of r.noMatch) lines.push(`  ${x.file}  (token=${x.token})`);
  lines.push('');
  lines.push(`## No usable token (${r.noToken.length})`);
  for (const x of r.noToken) lines.push(`  ${x.file}`);
  return lines.join('\n') + '\n';
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`auto-map-name-images: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const report = scanAndMap(data.products);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, formatReport(report), 'utf8');

  console.log(`auto-map-name-images: auto-mapped ${report.autoMapped.length}, ambiguous ${report.ambiguous.length}, no-match ${report.noMatch.length}, no-token ${report.noToken.length}`);
  console.log(`auto-map-name-images: report → ${REPORT_PATH}`);
}

main();
