import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');
const SCRAPE_PATH = path.join(ROOT, 'scripts', 'jotform-scrape.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'refill-from-jotform-report.txt');

const MATCH_THRESHOLD = 3;

interface JotformProduct { name: string; imageUrl: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface DataFile {
  categories: unknown;
  products: Product[];
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  const buf = Buffer.from(res.data);
  await sharp(buf)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(dest);
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

async function main(): Promise<void> {
  if (!fs.existsSync(SCRAPE_PATH)) {
    console.error(`Missing ${SCRAPE_PATH}.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const scraped = JSON.parse(fs.readFileSync(SCRAPE_PATH, 'utf8')) as JotformProduct[];

  const consumed = new Set<JotformProduct>();
  const candidates = scraped.slice();

  const targets = data.products.filter(p => !p.image || p.image.length === 0);
  console.log(`Refilling ${targets.length} cleared products from ${candidates.length} JotForm entries.`);

  const ordered = [...targets].sort((a, b) => b.name.length - a.name.length);
  const matches: Array<{ product: Product; jp: JotformProduct; score: number }> = [];

  for (const product of ordered) {
    const pnorm = normalise(product.name);
    let best: { jp: JotformProduct; score: number } | null = null;
    for (const jp of candidates) {
      if (consumed.has(jp)) continue;
      const s = scoreMatch(pnorm, normalise(jp.name));
      if (!best || s > best.score) best = { jp, score: s };
    }
    if (best && best.score >= MATCH_THRESHOLD) {
      consumed.add(best.jp);
      matches.push({ product, jp: best.jp, score: best.score });
    }
  }

  console.log(`Matched ${matches.length} / ${targets.length} cleared products to JotForm entries.`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const failed: Array<{ id: number; name: string; url: string; error: string }> = [];
  let downloaded = 0;

  for (const m of matches) {
    const dest = path.join(OUTPUT_DIR, `product-${m.product.id}.webp`);
    try {
      await downloadImage(m.jp.imageUrl, dest);
      downloaded++;
      console.log(`✓ ${m.product.id} ${m.product.name}  ←  "${m.jp.name}" (score ${m.score})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ id: m.product.id, name: m.product.name, url: m.jp.imageUrl, error: msg });
      console.warn(`✗ ${m.product.id} ${m.product.name} — ${msg}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const failedIds = new Set(failed.map(f => f.id));
  const downloadedIds = new Set(matches.filter(m => !failedIds.has(m.product.id)).map(m => m.product.id));

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);
  for (const p of data.products) {
    if (downloadedIds.has(p.id)) {
      p.image = `/images/products/product-${p.id}.webp`;
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Set image on ${downloadedIds.size} product(s) in data/products.json`);

  const matchedIds = new Set(matches.map(m => m.product.id));
  const stillUnmatched = targets.filter(t => !matchedIds.has(t.id));
  const lines: string[] = [
    `Refill from JotForm — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Cleared/unmatched targets: ${targets.length}`,
    `Matched: ${matches.length}`,
    `Downloaded: ${downloaded}  Failed: ${failed.length}`,
    `Still unmatched: ${stillUnmatched.length}`,
    '',
  ];
  if (matches.length) {
    lines.push('Matches:');
    for (const m of matches) {
      lines.push(`  #${m.product.id}  "${m.product.name}"  ←  "${m.jp.name}" (score ${m.score})`);
    }
    lines.push('');
  }
  if (stillUnmatched.length) {
    lines.push(`Still unmatched (${stillUnmatched.length}):`);
    for (const p of stillUnmatched) {
      lines.push(`  #${p.id}  "${p.name}"  (${p.categoryId})`);
    }
    lines.push('');
  }
  if (failed.length) {
    lines.push('Failed downloads:');
    for (const f of failed) lines.push(`  #${f.id} "${f.name}" — ${f.error}`);
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
