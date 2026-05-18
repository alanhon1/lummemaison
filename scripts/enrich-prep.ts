/**
 * Splits products into batches of 30 for Phase 2 content generation.
 * Each batch entry includes name, categoryName, specification, and the
 * existing description (subagents use these as the only factual grounding).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const OUT_DIR = path.join(ROOT, 'scripts', 'enrich-batches');
const BATCH_SIZE = 30;

interface Category { id: string; name: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
}
interface DataFile { categories: Category[]; products: Product[] }
interface BatchEntry {
  id: number;
  name: string;
  categoryName: string;
  specification: string;
  description: string;
}

function main(): void {
  const data: DataFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, ''));
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  // Target: every product (overwrite/regenerate any existing content for consistency).
  const entries: BatchEntry[] = data.products.map(p => ({
    id: p.id,
    name: p.name,
    categoryName: catName.get(p.categoryId) ?? p.categoryId,
    specification: p.specification,
    description: p.description,
  }));

  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let n = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    fs.writeFileSync(path.join(OUT_DIR, `batch-${n}.json`), JSON.stringify(batch, null, 2), 'utf8');
    n++;
  }
  console.log(`Wrote ${n} batches (${entries.length} products) to ${OUT_DIR}`);
}

main();
