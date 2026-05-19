/**
 * One-shot sweep: for every product with image=="", check if
 * public/images/products/product-{id}.{ext} exists on disk (any supported ext).
 * If found, set the JSON image field to the corresponding /images/products/ path.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.avif'];

interface Product { id: number; image: string; [k: string]: unknown }
interface DataFile { products: Product[]; categories: unknown[] }

function findImageFor(id: number): string | null {
  for (const ext of EXTS) {
    const p = path.join(IMG_DIR, `product-${id}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) {
      return `/images/products/product-${id}${ext}`;
    }
  }
  return null;
}

function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  let filled = 0;
  for (const p of data.products) {
    if (p.image && p.image.length > 0) continue;
    const found = findImageFor(p.id);
    if (found) {
      p.image = found;
      filled++;
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`sync-existing-images: filled ${filled} empty image fields from disk`);
}

main();
