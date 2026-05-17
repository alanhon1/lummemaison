/**
 * Reads scripts/secondary-candidates.json (with verifyStatus from Task 7)
 * and applies the verified results:
 *   - CONFIRMED images: rename product-{id}-secondary.webp to product-{id}.webp,
 *     set products.json[id].image = "/images/products/product-{id}.webp"
 *   - MISMATCH or UNCERTAIN images: delete the staging file, leave image empty
 *   - Descriptions (any candidate with non-empty candidateDescription, regardless
 *     of verifyStatus): persist into products.json[id].description if currently
 *     short. Descriptions are text-only — no vision verification needed.
 *
 * Also emits scripts/refill-report.txt and public/missingproducts.txt.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const CANDIDATES_FILE = path.join(process.cwd(), 'scripts', 'secondary-candidates.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'refill-report.txt');
const MISSING_FILE = path.join(process.cwd(), 'public', 'missingproducts.txt');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MIN_DESC_LEN = 50;

type VerifyStatus = 'CONFIRMED' | 'MISMATCH' | 'UNCERTAIN';
interface Candidate {
  id: number;
  productName: string;
  matchedSlug: string;
  matchedName: string;
  matchScore: number;
  stagingImagePath: string;
  candidateDescription: string;
  verifyStatus?: VerifyStatus;
  verifyReason?: string;
}
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
  description: string;
}
interface Category { id: string; name: string }
interface DataFile { categories: Category[]; products: Product[] }

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const data: DataFile = readJson<DataFile>(DATA_FILE);
  const candidates: Candidate[] = readJson<Candidate[]>(CANDIDATES_FILE);
  const candById = new Map(candidates.map(c => [c.id, c]));
  const productById = new Map(data.products.map(p => [p.id, p]));
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  backupDataFile();

  let imagesFilled = 0, imagesRejected = 0, descsFilled = 0;
  const promoted: number[] = [];
  const rejected: number[] = [];

  for (const c of candidates) {
    const p = productById.get(c.id);
    if (!p) continue;

    // Image side
    if (c.stagingImagePath && c.verifyStatus === 'CONFIRMED') {
      const stagingBase = path.basename(c.stagingImagePath);
      const finalBase = stagingBase.replace('-secondary.webp', '.webp');
      const stagingAbs = path.join(IMAGE_DIR, stagingBase);
      const finalAbs = path.join(IMAGE_DIR, finalBase);
      if (fs.existsSync(stagingAbs)) {
        if (fs.existsSync(finalAbs)) fs.unlinkSync(finalAbs);
        fs.renameSync(stagingAbs, finalAbs);
        p.image = `/images/products/${finalBase}`;
        imagesFilled++;
        promoted.push(c.id);
      }
    } else if (c.stagingImagePath && (c.verifyStatus === 'MISMATCH' || c.verifyStatus === 'UNCERTAIN')) {
      const stagingBase = path.basename(c.stagingImagePath);
      const stagingAbs = path.join(IMAGE_DIR, stagingBase);
      if (fs.existsSync(stagingAbs)) fs.unlinkSync(stagingAbs);
      imagesRejected++;
      rejected.push(c.id);
    }

    // Description side (no vision needed — text comes from matched product page)
    if (c.candidateDescription && c.candidateDescription.length >= MIN_DESC_LEN &&
        (!p.description || p.description.length < MIN_DESC_LEN)) {
      p.description = c.candidateDescription;
      descsFilled++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Filled ${imagesFilled} image(s), rejected ${imagesRejected}, filled ${descsFilled} description(s).`);

  // Refill report
  const reportLines: string[] = [];
  reportLines.push(`=== PROMOTED IMAGES (${promoted.length}) ===`);
  for (const id of promoted) {
    const c = candById.get(id)!;
    reportLines.push(`#${id}  ${c.productName}  ←  ${c.matchedSlug}`);
  }
  reportLines.push('');
  reportLines.push(`=== REJECTED CANDIDATES (${rejected.length}) ===`);
  for (const id of rejected) {
    const c = candById.get(id)!;
    reportLines.push(`#${id}  ${c.productName}  ←  ${c.matchedSlug}  reason: ${c.verifyReason ?? '?'}`);
  }
  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');

  // missingproducts.txt: every product still missing image or description
  const missing = data.products.filter(p =>
    !p.image || p.image.length === 0 || !p.description || p.description.length < MIN_DESC_LEN
  );

  const lines: string[] = [];
  lines.push('# missingproducts.txt');
  lines.push(`# Last generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('# Products that could not be enriched from aesthetics-shop.com or mg.gofillerss.com.');
  lines.push('# Manually source images and/or descriptions for these and add them via the admin UI.');
  lines.push('');
  lines.push('ID   | Name                                    | Category              | Missing');
  lines.push('---- | --------------------------------------- | --------------------- | -----------------');
  for (const p of missing) {
    const missingFields: string[] = [];
    if (/^Product \d+$/.test(p.name)) missingFields.push('name');
    if (!p.image || p.image.length === 0) missingFields.push('image');
    if (!p.description || p.description.length < MIN_DESC_LEN) missingFields.push('description');
    lines.push(
      `${String(p.id).padEnd(4)} | ${p.name.padEnd(39)} | ${(catName.get(p.categoryId) ?? p.categoryId).padEnd(21)} | ${missingFields.join(', ')}`
    );
  }
  fs.writeFileSync(MISSING_FILE, lines.join('\n'), 'utf8');
  console.log(`Wrote ${missing.length} entries to ${MISSING_FILE}`);
}

main();
