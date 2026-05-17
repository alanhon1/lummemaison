/**
 * Splits every product's description + specification into translation
 * batches for ru and ko. Writes scripts/translate-batches/{locale}/batch-{N}.json.
 * Each batch is a JSON array of {id, field, source} tuples where source is
 * the English text the worker subagent will translate.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUT_ROOT = path.join(process.cwd(), 'scripts', 'translate-batches');
const LOCALES = ['ru', 'ko'] as const;
const BATCH_SIZE = 25;

interface Product {
  id: number;
  description: string;
  specification: string;
}
interface Tuple {
  id: number;
  field: 'description' | 'specification';
  source: string;
}

function main(): void {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const tuples: Tuple[] = [];
  for (const p of data.products) {
    if (p.description && p.description.length > 0) {
      tuples.push({ id: p.id, field: 'description', source: p.description });
    }
    if (p.specification && p.specification.length > 0) {
      tuples.push({ id: p.id, field: 'specification', source: p.specification });
    }
  }

  if (fs.existsSync(OUT_ROOT)) {
    fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const locale of LOCALES) {
    const localeDir = path.join(OUT_ROOT, locale);
    fs.mkdirSync(localeDir, { recursive: true });
    let batchIdx = 0;
    for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
      const batch = tuples.slice(i, i + BATCH_SIZE);
      const outPath = path.join(localeDir, `batch-${batchIdx}.json`);
      fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf8');
      batchIdx++;
    }
    console.log(`Locale ${locale}: wrote ${batchIdx} batches (${tuples.length} tuples) to ${localeDir}`);
  }
}

main();
