/**
 * Read every scripts/translate-batches/batch-*.json and merge into
 * data/translations/{ko,ru}.json. Preserves existing keys not present
 * in the batch outputs.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BATCHES_DIR = path.join(ROOT, 'scripts', 'translate-batches');
const TRANSLATIONS_DIR = path.join(ROOT, 'data', 'translations');
const REPORT_PATH = path.join(ROOT, 'scripts', 'merge-translations-report.txt');

type FieldBundle = { description?: string; indication?: string; protocol?: string; packaging?: string; specification?: string };
type LocaleMap = Record<string, FieldBundle>;

interface BatchFile {
  ko?: LocaleMap;
  ru?: LocaleMap;
}

function readJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) as T;
}

function main(): void {
  const koPath = path.join(TRANSLATIONS_DIR, 'ko.json');
  const ruPath = path.join(TRANSLATIONS_DIR, 'ru.json');

  const koExisting = fs.existsSync(koPath) ? readJSON<LocaleMap>(koPath) : {};
  const ruExisting = fs.existsSync(ruPath) ? readJSON<LocaleMap>(ruPath) : {};

  let koUpdates = 0;
  let ruUpdates = 0;
  const perBatch: Array<{ file: string; lang: string; count: number }> = [];

  // Read per-language batch dirs.
  for (const lang of ['ko', 'ru'] as const) {
    const dir = path.join(BATCHES_DIR, lang);
    if (!fs.existsSync(dir)) continue;
    const target = lang === 'ko' ? koExisting : ruExisting;
    const files = fs.readdirSync(dir).filter(f => /^batch-\d+\.json$/.test(f)).sort();
    for (const file of files) {
      let batch: LocaleMap;
      try {
        batch = readJSON<LocaleMap>(path.join(dir, file));
      } catch (err) {
        console.warn(`skip ${lang}/${file}: ${(err as Error).message}`);
        continue;
      }
      let count = 0;
      for (const [id, fields] of Object.entries(batch)) {
        if (!fields || typeof fields !== 'object') continue;
        target[id] = { ...target[id], ...fields };
        if (lang === 'ko') koUpdates++; else ruUpdates++;
        count++;
      }
      perBatch.push({ file, lang, count });
    }
  }

  // Legacy combined-format support: top-level batch-*.json with {ko, ru}.
  const topFiles = fs.readdirSync(BATCHES_DIR).filter(f => /^batch-\d+\.json$/.test(f)).sort();
  for (const file of topFiles) {
    let batch: BatchFile;
    try {
      batch = readJSON<BatchFile>(path.join(BATCHES_DIR, file));
    } catch { continue; }
    if (batch.ko) {
      for (const [id, fields] of Object.entries(batch.ko)) {
        koExisting[id] = { ...koExisting[id], ...fields };
        koUpdates++;
      }
    }
    if (batch.ru) {
      for (const [id, fields] of Object.entries(batch.ru)) {
        ruExisting[id] = { ...ruExisting[id], ...fields };
        ruUpdates++;
      }
    }
  }

  fs.writeFileSync(koPath, JSON.stringify(koExisting, null, 2) + '\n', 'utf8');
  fs.writeFileSync(ruPath, JSON.stringify(ruExisting, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# merge-translations report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`ko updates: ${koUpdates}`);
  lines.push(`ru updates: ${ruUpdates}`);
  lines.push('');
  for (const b of perBatch) lines.push(`  ${b.file}  ko=${b.ko}  ru=${b.ru}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`merge-translations: ko=${koUpdates} ru=${ruUpdates} batches=${batchFiles.length}`);
  console.log(`merge-translations: report -> ${REPORT_PATH}`);
}

main();
