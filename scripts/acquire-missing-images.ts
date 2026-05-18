/**
 * For every product with empty image OR current image < MIN_DIM,
 * try gofillerss first then aesthetics-shop. Apply strict scoring +
 * dimension filters before downloading. Updates data/products.json.
 *
 * Vision audit must follow separately to catch cross-brand mismatches.
 */

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import { normalise, strictScoreMatch } from './lib/fuzzy-match';
import { fetchAllGofillerssProducts, GofillerssProduct } from './sync-from-gofillerss';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'acquire-missing-report.txt');
const AS_SITEMAP = 'https://aesthetics-shop.com/product-sitemap.xml';

const MIN_DIM = 400;
const STRICT_SCORE = 4;
const MIN_CANDIDATE_DIM = 500;

interface ASProduct { name: string; imageUrl: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface DataFile { products: Product[] }

async function fetchASSitemap(): Promise<ASProduct[]> {
  const res = await axios.get<string>(AS_SITEMAP, { timeout: 30_000 });
  const xml = res.data;
  const products: ASProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(?:<!\[CDATA\[)?(https:\/\/aesthetics-shop\.com\/product\/([^\]<]+?)\/??)(?:\]\]>)?<\/loc>/);
    const imgMatch = block.match(/<image:loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\]\s<]+?)\s*(?:\]\]>)?\s*<\/image:loc>/);
    if (!locMatch || !imgMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');
    products.push({ name: slug.replace(/-/g, ' '), imageUrl: imgMatch[1] });
  }
  return products;
}

async function downloadAndMeasure(url: string): Promise<{ buf: Buffer; maxDim: number } | null> {
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const buf = Buffer.from(res.data);
    const meta = await sharp(buf).metadata();
    const maxDim = Math.max(meta.width || 0, meta.height || 0);
    return { buf, maxDim };
  } catch {
    return null;
  }
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

async function main(): Promise<void> {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;

  // Identify targets: empty image OR low-res image.
  const targets: Product[] = [];
  for (const p of data.products) {
    if (!p.image) { targets.push(p); continue; }
    const fp = path.join(OUTPUT_DIR, p.image.replace(/^\/images\/products\//, ''));
    if (!fs.existsSync(fp)) { targets.push(p); continue; }
    try {
      const meta = await sharp(fp).metadata();
      const maxDim = Math.max(meta.width || 0, meta.height || 0);
      if (maxDim < MIN_DIM) targets.push(p);
    } catch {
      targets.push(p);
    }
  }
  console.log(`Targets: ${targets.length} products (empty image or < ${MIN_DIM}px)`);

  console.log('Fetching gofillerss sitemap…');
  const gf = await fetchAllGofillerssProducts();
  console.log(`gofillerss: ${gf.length} products`);

  console.log('Fetching aesthetics-shop sitemap…');
  const as = await fetchASSitemap();
  console.log(`aesthetics-shop: ${as.length} products`);

  const acquired: Array<{ product: Product; source: string; sourceName: string; oldDim: number | null; newDim: number; score: number }> = [];
  const failed: Array<{ product: Product; reason: string }> = [];

  for (const product of targets) {
    const pnorm = normalise(product.name);

    let oldDim: number | null = null;
    if (product.image) {
      const fp = path.join(OUTPUT_DIR, product.image.replace(/^\/images\/products\//, ''));
      if (fs.existsSync(fp)) {
        try {
          const m = await sharp(fp).metadata();
          oldDim = Math.max(m.width || 0, m.height || 0);
        } catch {}
      }
    }

    // Score gofillerss candidates — strict brand-prefix-aware.
    let bestGf: { c: GofillerssProduct; score: number } | null = null;
    for (const c of gf) {
      const s = strictScoreMatch(product.name, pnorm, c.name, normalise(c.name));
      if (!bestGf || s > bestGf.score) bestGf = { c, score: s };
    }

    // Score aesthetics-shop candidates — strict brand-prefix-aware.
    let bestAs: { c: ASProduct; score: number } | null = null;
    for (const c of as) {
      const s = strictScoreMatch(product.name, pnorm, c.name, normalise(c.name));
      if (!bestAs || s > bestAs.score) bestAs = { c, score: s };
    }

    // Pick which to try: highest score, must be >= STRICT_SCORE.
    type Cand = { source: 'gofillerss' | 'aesthetics-shop'; name: string; url: string; score: number };
    const cands: Cand[] = [];
    if (bestGf && bestGf.score >= STRICT_SCORE) cands.push({ source: 'gofillerss', name: bestGf.c.name, url: bestGf.c.imageUrl, score: bestGf.score });
    if (bestAs && bestAs.score >= STRICT_SCORE) cands.push({ source: 'aesthetics-shop', name: bestAs.c.name, url: bestAs.c.imageUrl, score: bestAs.score });
    cands.sort((a, b) => b.score - a.score);

    if (cands.length === 0) {
      failed.push({ product, reason: `no candidate scored >= ${STRICT_SCORE}` });
      continue;
    }

    // Try each candidate in order; accept first that meets dimension threshold.
    let accepted: { cand: Cand; dim: number; buf: Buffer } | null = null;
    for (const cand of cands) {
      const r = await downloadAndMeasure(cand.url);
      if (!r) continue;
      if (r.maxDim < MIN_CANDIDATE_DIM) continue;
      if (oldDim !== null && r.maxDim < oldDim) continue; // don't downgrade
      accepted = { cand, dim: r.maxDim, buf: r.buf };
      break;
    }

    if (!accepted) {
      failed.push({ product, reason: `no candidate met dim >= ${MIN_CANDIDATE_DIM}` });
      continue;
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const dest = path.join(OUTPUT_DIR, `product-${product.id}.webp`);
    try {
      await sharp(accepted.buf)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(dest);
      acquired.push({
        product,
        source: accepted.cand.source,
        sourceName: accepted.cand.name,
        oldDim,
        newDim: accepted.dim,
        score: accepted.cand.score,
      });
      console.log(`✓ #${product.id} ${product.name}  ${oldDim ? oldDim + 'px → ' : '∅ → '}${accepted.dim}px  (${accepted.cand.source}, score ${accepted.cand.score})`);
    } catch (err: unknown) {
      failed.push({ product, reason: err instanceof Error ? err.message : String(err) });
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Update JSON.
  if (acquired.length > 0) {
    const backup = backupDataFile();
    console.log(`Backup: ${backup}`);
    const acquiredIds = new Set(acquired.map(a => a.product.id));
    for (const p of data.products) {
      if (acquiredIds.has(p.id)) p.image = `/images/products/product-${p.id}.webp`;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Updated ${acquired.length} image fields in products.json`);
  }

  const lines: string[] = [
    `Acquire missing images — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Targets: ${targets.length}`,
    `Acquired: ${acquired.length}`,
    `Failed:   ${failed.length}`,
    '',
  ];
  for (const a of acquired) {
    lines.push(`✓ #${a.product.id} "${a.product.name}"  ${a.oldDim ?? '∅'}px → ${a.newDim}px  (${a.source}: "${a.sourceName}", score ${a.score})`);
  }
  lines.push('');
  for (const f of failed) {
    lines.push(`✗ #${f.product.id} "${f.product.name}"  (${f.reason})`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
