/**
 * Read-only verification of Phase 1 Jotform pairings.
 * Flags products with Jotform-sourced description prose that look
 * suspicious. Does not mutate data/products.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractBrandPrefix } from './lib/fuzzy-match';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'verify-jotform-matches-report.txt');

interface Product {
  id: number;
  name: string;
  description: string;
  indication?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

const KNOWN_BRANDS = ['SOSUM', 'JUVIDERM', 'RESTYLANE', 'BOTOX', 'BOTULAX', 'REGENOVUE', 'NEURAMIS', 'REVOLAX', 'ELASTY'];

interface Warning { kind: string; id: number; name: string; preview: string }

function isJotformProse(p: Product): boolean {
  const d = p.description || '';
  if (d.length < 100) return false;
  if (/\bis a professional-use product\b/i.test(d)) return false;
  return true;
}

function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const warnings: Warning[] = [];

  for (const p of data.products) {
    if (!isJotformProse(p)) continue;
    const desc = p.description || '';
    const ind = (p.indication as string | undefined) || '';
    const preview = desc.slice(0, 60).replace(/\s+/g, ' ');

    const brand = extractBrandPrefix(p.name);
    if (brand) {
      const hay = (desc + ' ' + ind).toLowerCase();
      if (!hay.includes(brand.toLowerCase())) {
        warnings.push({ kind: 'missing-brand', id: p.id, name: p.name, preview });
      }
    }

    if (desc.length < 50) {
      warnings.push({ kind: 'description-too-short', id: p.id, name: p.name, preview });
    }

    const ownUpper = p.name.toUpperCase();
    for (const b of KNOWN_BRANDS) {
      if (ownUpper.includes(b)) continue;
      if (desc.toUpperCase().includes(b)) {
        warnings.push({ kind: 'cross-brand', id: p.id, name: p.name, preview: `${preview} [contains "${b}"]` });
      }
    }
  }

  const lines: string[] = [];
  lines.push('# verify-jotform-matches report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`total warnings: ${warnings.length}`);
  lines.push('');

  for (const kind of ['missing-brand', 'description-too-short', 'cross-brand']) {
    const subset = warnings.filter(w => w.kind === kind);
    lines.push(`## ${kind} (${subset.length})`);
    for (const w of subset) {
      lines.push(`  #${w.id}  ${w.name}  --  ${w.preview}`);
    }
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`verify-jotform-matches: ${warnings.length} warnings -> ${REPORT_PATH}`);
}

main();
