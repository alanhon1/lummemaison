import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'clean-mangled-names-report.txt');

interface Product { id: number; name: string }
interface DataFile { products: Product[] }

/**
 * Explicit, audited list of whitespace-mangled product names. Each entry says:
 *   "if product #id has name === before, rewrite to after".
 *
 * This is deliberately not a generic regex: many legitimate product names
 * contain single-letter tokens that look like fragments (e.g. "SUB - Q PLUS",
 * "MIRACLE H HA", "VITA K REPAIR", "LIPOLAB V LINE"), and a regex tuned to
 * catch the real mangles also eats those. The targeted list below was derived
 * by inspecting data/products.json against sibling rows in the same brand line.
 */
const RENAMES: ReadonlyArray<{ id: number; before: string; after: string }> = [
  { id: 18,  before: 'VOM INTEN S E',                                  after: 'VOM INTENSE' },
  { id: 32,  before: 'T ESORO DEEP PLUS',                              after: 'TESORO DEEP PLUS' },
  { id: 34,  before: 'T ESORO IMPLANT WITH LIDOCAINE',                 after: 'TESORO IMPLANT WITH LIDOCAINE' },
  { id: 81,  before: 'H YALACE',                                       after: 'HYALACE' },
  { id: 91,  before: 'R EGENOVUE AQUASHINE PLUS GOLD',                 after: 'REGENOVUE AQUASHINE PLUS GOLD' },
  { id: 92,  before: 'R EGENOVUE AQUASHINE SILVER',                    after: 'REGENOVUE AQUASHINE SILVER' },
  { id: 127, before: 'LAPUROON AURORA S UPER',                         after: 'LAPUROON AURORA SUPER' },
  { id: 128, before: 'LAPUROON AURORA V IVID',                         after: 'LAPUROON AURORA VIVID' },
  { id: 130, before: '2 XSOME',                                        after: '2XSOME' },
  { id: 132, before: 'E XOXE',                                         after: 'EXOXE' },
  { id: 133, before: 'E XOBOOM SKIN',                                  after: 'EXOBOOM SKIN' },
  { id: 198, before: 'V V REPIDA AZULENE H9 DERMA PLUS BOOSTER CREAM', after: 'VV REPIDA AZULENE H9 DERMA PLUS BOOSTER CREAM' },
  { id: 323, before: 'M EDITOXIN',                                     after: 'MEDITOXIN' },
  { id: 325, before: 'RE N TOX',                                       after: 'RENTOX' },
  { id: 341, before: 'P LACENTEX Inj. Polydeoxyribonucleotide Sodium', after: 'PLACENTEX Inj. Polydeoxyribonucleotide Sodium' },
  { id: 346, before: 'E TREBELLE',                                     after: 'ETREBELLE' },
  { id: 398, before: 'M UCHCAINE',                                     after: 'MUCHCAINE' },
  { id: 399, before: 'M UCHCAINE',                                     after: 'MUCHCAINE' },
  { id: 404, before: 'C URACEN JBP PLAMON INJ',                        after: 'CURACEN JBP PLAMON INJ' },
  { id: 425, before: 'SYRINGE MI X ING TUBE (CONNECTOR) (For',         after: 'SYRINGE MIXING TUBE (CONNECTOR) (For' },
];

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const changes: Array<{ id: number; before: string; after: string }> = [];
  const skipped: Array<{ id: number; expected: string; actual: string }> = [];

  const byId = new Map<number, Product>();
  for (const p of data.products) byId.set(p.id, p);

  for (const rule of RENAMES) {
    const p = byId.get(rule.id);
    if (!p) {
      skipped.push({ id: rule.id, expected: rule.before, actual: '<missing>' });
      continue;
    }
    if (p.name === rule.before) {
      p.name = rule.after;
      changes.push({ id: rule.id, before: rule.before, after: rule.after });
    } else if (p.name !== rule.after) {
      // Name was neither the expected mangle nor the cleaned form — skip and report.
      skipped.push({ id: rule.id, expected: rule.before, actual: p.name });
    }
  }

  if (changes.length === 0) {
    const msg = skipped.length === 0
      ? 'No mangled names found. Nothing to do.\n'
      : `No applicable changes. ${skipped.length} rule(s) skipped (name mismatch):\n`
        + skipped.map(s => `  #${s.id} expected "${s.expected}" but found "${s.actual}"`).join('\n')
        + '\n';
    console.log(msg.trim());
    fs.writeFileSync(REPORT_PATH, msg, 'utf8');
    return;
  }

  const backup = backupDataFile();
  console.log(`Backup written to ${backup}`);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${changes.length} product name(s) in data/products.json`);

  const lines: string[] = [
    `Clean mangled names — ${new Date().toISOString()}`,
    '='.repeat(48),
    '',
    `Total changes: ${changes.length}`,
    '',
  ];
  for (const c of changes) {
    lines.push(`#${c.id}  "${c.before}"  →  "${c.after}"`);
  }
  if (skipped.length > 0) {
    lines.push('', `Skipped: ${skipped.length}`);
    for (const s of skipped) {
      lines.push(`  #${s.id} expected "${s.expected}" but found "${s.actual}"`);
    }
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Report written to ${REPORT_PATH}`);
}

main();
