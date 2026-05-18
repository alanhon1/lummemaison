/**
 * Measure every product image's dimensions. Output the low-quality subset
 * (empty image OR max dimension < THRESHOLD) as scripts/low-quality-targets.json
 * for the next acquisition pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const IMAGE_DIR = path.join(ROOT, 'public', 'images', 'products');
const OUT_FILE = path.join(ROOT, 'scripts', 'low-quality-targets.json');
const REPORT_FILE = path.join(ROOT, 'scripts', 'inventory-report.txt');

const THRESHOLD = 600;

interface Category { id: string; name: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  image: string;
}
interface DataFile { categories: Category[]; products: Product[] }
interface Target {
  id: number;
  name: string;
  categoryName: string;
  specification: string;
  currentImage: string;
  currentMaxDim: number; // 0 if no image
}

async function main(): Promise<void> {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '')) as DataFile;
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  const buckets = { empty: 0, tiny: 0, small: 0, medium: 0, large: 0 };
  const targets: Target[] = [];

  for (const p of data.products) {
    if (!p.image) {
      buckets.empty++;
      targets.push({
        id: p.id,
        name: p.name,
        categoryName: catName.get(p.categoryId) ?? p.categoryId,
        specification: p.specification,
        currentImage: '',
        currentMaxDim: 0,
      });
      continue;
    }
    const fp = path.join(IMAGE_DIR, p.image.replace(/^\/images\/products\//, ''));
    if (!fs.existsSync(fp)) {
      buckets.empty++;
      targets.push({
        id: p.id,
        name: p.name,
        categoryName: catName.get(p.categoryId) ?? p.categoryId,
        specification: p.specification,
        currentImage: p.image,
        currentMaxDim: 0,
      });
      continue;
    }
    try {
      const m = await sharp(fp).metadata();
      const maxDim = Math.max(m.width || 0, m.height || 0);
      if (maxDim < 250) buckets.tiny++;
      else if (maxDim < THRESHOLD) buckets.small++;
      else if (maxDim < 1000) buckets.medium++;
      else buckets.large++;
      if (maxDim < THRESHOLD) {
        targets.push({
          id: p.id,
          name: p.name,
          categoryName: catName.get(p.categoryId) ?? p.categoryId,
          specification: p.specification,
          currentImage: p.image,
          currentMaxDim: maxDim,
        });
      }
    } catch {
      targets.push({
        id: p.id,
        name: p.name,
        categoryName: catName.get(p.categoryId) ?? p.categoryId,
        specification: p.specification,
        currentImage: p.image,
        currentMaxDim: 0,
      });
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(targets, null, 2), 'utf8');

  const lines = [
    `Image quality inventory — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Total products: ${data.products.length}`,
    `  Empty / missing file: ${buckets.empty}`,
    `  Tiny (< 250px):       ${buckets.tiny}`,
    `  Small (< ${THRESHOLD}px):       ${buckets.small}`,
    `  Medium (< 1000px):    ${buckets.medium}`,
    `  Large (≥ 1000px):     ${buckets.large}`,
    '',
    `Low-quality targets written to ${OUT_FILE}: ${targets.length}`,
  ];
  fs.writeFileSync(REPORT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
}

main();
