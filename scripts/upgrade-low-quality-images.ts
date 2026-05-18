/**
 * For every product whose current local image is smaller than MIN_DIM,
 * try to find a higher-resolution replacement in aesthetics-shop.com's
 * sitemap. Only replaces when:
 *   - Match score >= STRICT_THRESHOLD (avoid cross-brand swaps)
 *   - Candidate image is at least UPGRADE_RATIO times larger than current
 *
 * After running, vision audit any replaced images separately.
 */

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'products');
const REPORT_PATH = path.join(ROOT, 'scripts', 'upgrade-low-quality-report.txt');
const SITEMAP_URL = 'https://aesthetics-shop.com/product-sitemap.xml';

const MIN_DIM = 500;
const STRICT_THRESHOLD = 4;
const UPGRADE_RATIO = 1.5;

interface ASProduct { slug: string; name: string; imageUrl: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface DataFile { products: Product[] }

async function fetchSitemap(): Promise<ASProduct[]> {
  const res = await axios.get<string>(SITEMAP_URL, { timeout: 30_000 });
  const xml = res.data;
  const products: ASProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(?:<!\[CDATA\[)?(https:\/\/aesthetics-shop\.com\/product\/([^\]<]+?)\/??)(?:\]\]>)?<\/loc>/);
    const imgMatch = block.match(/<image:loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\]\s<]+?)\s*(?:\]\]>)?\s*<\/image:loc>/);
    if (!locMatch || !imgMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');
    products.push({ slug, name: slug.replace(/-/g, ' '), imageUrl: imgMatch[1] });
  }
  return products;
}

async function main(): Promise<void> {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;

  // Find low-res candidates.
  const lowQuality: Array<{ product: Product; width: number; height: number; maxDim: number }> = [];
  for (const p of data.products) {
    if (!p.image) continue;
    const filename = p.image.replace(/^\/images\/products\//, '');
    const filePath = path.join(OUTPUT_DIR, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const meta = await sharp(filePath).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;
      const maxDim = Math.max(w, h);
      if (maxDim < MIN_DIM) lowQuality.push({ product: p, width: w, height: h, maxDim });
    } catch {
      // skip on read errors
    }
  }
  console.log(`Found ${lowQuality.length} low-quality images (< ${MIN_DIM}px largest side).`);

  console.log('Fetching aesthetics-shop sitemap…');
  const sitemap = await fetchSitemap();
  console.log(`Sitemap has ${sitemap.length} products.`);

  type Outcome =
    | { product: Product; status: 'UPGRADED'; oldDim: number; newDim: number; source: string; score: number }
    | { product: Product; status: 'NO_MATCH'; reason: string }
    | { product: Product; status: 'NO_UPGRADE'; reason: string; score: number; oldDim: number; candDim: number }
    | { product: Product; status: 'ERROR'; reason: string };

  const outcomes: Outcome[] = [];

  for (const lq of lowQuality) {
    const pnorm = normalise(lq.product.name);
    let best: { c: ASProduct; score: number } | null = null;
    for (const c of sitemap) {
      const s = scoreMatch(pnorm, normalise(c.name));
      if (!best || s > best.score) best = { c, score: s };
    }
    if (!best || best.score < STRICT_THRESHOLD) {
      outcomes.push({ product: lq.product, status: 'NO_MATCH', reason: `best score ${best?.score ?? 0} below threshold` });
      continue;
    }

    // Download candidate, check dimensions.
    try {
      const res = await axios.get<ArrayBuffer>(best.c.imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const buf = Buffer.from(res.data);
      const meta = await sharp(buf).metadata();
      const candDim = Math.max(meta.width || 0, meta.height || 0);
      if (candDim < lq.maxDim * UPGRADE_RATIO) {
        outcomes.push({
          product: lq.product,
          status: 'NO_UPGRADE',
          reason: `candidate ${candDim}px not >= ${UPGRADE_RATIO}x current ${lq.maxDim}px`,
          score: best.score,
          oldDim: lq.maxDim,
          candDim,
        });
        continue;
      }
      // Replace.
      const filename = lq.product.image.replace(/^\/images\/products\//, '');
      const filePath = path.join(OUTPUT_DIR, filename);
      await sharp(buf)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filePath);
      const newMeta = await sharp(filePath).metadata();
      outcomes.push({
        product: lq.product,
        status: 'UPGRADED',
        oldDim: lq.maxDim,
        newDim: Math.max(newMeta.width || 0, newMeta.height || 0),
        source: best.c.imageUrl,
        score: best.score,
      });
      console.log(`✓ #${lq.product.id} ${lq.product.name}  ${lq.maxDim}px → ${candDim}px`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      outcomes.push({ product: lq.product, status: 'ERROR', reason: msg });
      console.warn(`✗ #${lq.product.id} ${lq.product.name} — ${msg}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const counts = { UPGRADED: 0, NO_MATCH: 0, NO_UPGRADE: 0, ERROR: 0 };
  for (const o of outcomes) counts[o.status]++;
  console.log(`\nCounts:`, counts);

  const lines: string[] = [
    `Upgrade low-quality images — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Low-quality candidates (< ${MIN_DIM}px): ${lowQuality.length}`,
    `Upgraded:   ${counts.UPGRADED}`,
    `No match:   ${counts.NO_MATCH}`,
    `No upgrade: ${counts.NO_UPGRADE}`,
    `Errors:     ${counts.ERROR}`,
    '',
  ];
  for (const o of outcomes) {
    if (o.status === 'UPGRADED') lines.push(`✓ #${o.product.id} "${o.product.name}"  ${o.oldDim}px → ${o.newDim}px  (score ${o.score})`);
  }
  lines.push('');
  for (const o of outcomes) {
    if (o.status === 'NO_UPGRADE') lines.push(`= #${o.product.id} "${o.product.name}"  ${o.reason}`);
  }
  lines.push('');
  for (const o of outcomes) {
    if (o.status === 'NO_MATCH') lines.push(`? #${o.product.id} "${o.product.name}"  (${o.reason})`);
  }
  for (const o of outcomes) {
    if (o.status === 'ERROR') lines.push(`✗ #${o.product.id} "${o.product.name}"  ${o.reason}`);
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
