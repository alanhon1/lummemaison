/**
 * Splits products with an existing image into batches of 30 for
 * Phase 1 vision audit. Outputs scripts/audit-batches/batch-{n}.json,
 * where each entry has the absolute path the vision subagent will Read.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUT_DIR = path.join(process.cwd(), 'scripts', 'audit-batches');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BATCH_SIZE = 30;

interface Category { id: string; name: string }
interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}
interface BatchEntry {
  id: number;
  name: string;
  categoryName: string;
  imagePath: string;
}

function main(): void {
  const data: { categories: Category[]; products: Product[] } =
    JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const catName = new Map(data.categories.map(c => [c.id, c.name]));

  const eligible = data.products
    .filter(p => p.image && typeof p.image === 'string' && p.image.length > 0)
    .map<BatchEntry>(p => {
      const imageBasename = p.image.replace(/^\/images\/products\//, '');
      return {
        id: p.id,
        name: p.name,
        categoryName: catName.get(p.categoryId) ?? p.categoryId,
        imagePath: path.join(IMAGE_DIR, imageBasename),
      };
    });

  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let batchIdx = 0;
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const outPath = path.join(OUT_DIR, `batch-${batchIdx}.json`);
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf8');
    batchIdx++;
  }

  console.log(`Wrote ${batchIdx} batches (${eligible.length} products) to ${OUT_DIR}`);
}

main();
