/**
 * Reshapes scripts/translate-results/{locale}.json (flat tuple array) into
 * data/translations/{locale}.json (id-keyed object), one file per locale.
 * Final shape:
 *   { "<productId>": { "description": "...", "specification": "..." } }
 */

import fs from 'fs';
import path from 'path';

const RESULTS_ROOT = path.join(process.cwd(), 'scripts', 'translate-results');
const OUT_ROOT = path.join(process.cwd(), 'data', 'translations');
const LOCALES = ['ru', 'ko'] as const;

interface Tuple {
  id: number;
  field: 'description' | 'specification';
  translated: string;
}
type Translations = Record<string, { description?: string; specification?: string }>;

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function main(): void {
  if (!fs.existsSync(OUT_ROOT)) fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const locale of LOCALES) {
    const inFile = path.join(RESULTS_ROOT, `${locale}.json`);
    if (!fs.existsSync(inFile)) {
      console.error(`Missing ${inFile}`);
      process.exit(1);
    }
    const tuples = readJson<Tuple[]>(inFile);
    const grouped: Translations = {};
    for (const t of tuples) {
      if (!t.translated || t.translated.length === 0) continue;
      const key = String(t.id);
      if (!grouped[key]) grouped[key] = {};
      grouped[key][t.field] = t.translated;
    }
    const outFile = path.join(OUT_ROOT, `${locale}.json`);
    fs.writeFileSync(outFile, JSON.stringify(grouped, null, 2), 'utf8');
    console.log(`Wrote ${Object.keys(grouped).length} product entries to ${outFile}`);
  }
}

main();
