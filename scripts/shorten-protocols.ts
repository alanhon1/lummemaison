/**
 * Replace verbose category-template protocols with 1-sentence equivalents.
 * Preserves Jotform-derived protocols (those not matching the long template
 * leading phrases).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'shorten-protocols-report.txt');

interface Product {
  id: number;
  name: string;
  categoryId: string;
  protocol?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: Array<{ id: string }> }

const SHORT_TEMPLATES: Record<string, string> = {
  'fillers': 'Inject at the indicated dermal depth using a 27-30G needle; aspirate before each bolus.',
  'mesotherapy': 'Inject intradermally at 1-4 mm depth using a 30G needle; cycle weekly for 4-8 sessions.',
  'acne-treatment': 'Apply a thin layer to clean, dry skin 1-2× daily; pair with broad-spectrum SPF 30+.',
  'hair-treatment': 'Apply or inject at the scalp at 2-3 mm depth; cycle weekly for 4-6 sessions.',
  'pharmacy-favourites': 'Use per product label and prescriber direction; observe storage and expiration.',
  'topical-cosmetics': 'Apply a thin layer to clean, dry skin morning and/or evening; pair AM with SPF 30+.',
  'intimate-care': 'Apply a small amount externally to the V-zone 1-2× daily; avoid mucosal surfaces.',
  'growth-factor-exosome': 'Reconstitute with the supplied diluent; apply via microneedling or 30G mesotherapy.',
  'curenex': 'Use per the Curenex product type; injectables go intradermally at 1-2 mm with a 30G needle.',
  'dermagen': 'Apply a thin layer to clean, dry skin 1-2× daily; pair AM with broad-spectrum SPF 30+.',
  'gtm': 'Apply per product type; in-clinic peels follow neutralization per the manufacturer protocol.',
  'equipment': 'Reserved for trained operators; calibrate, configure per indication, treat in even passes.',
  'salon-grade': 'Professional spa use; apply per product type and rinse or remove per the protocol.',
  'lipolytics': 'Inject subcutaneously into the fat compartment at 6-13 mm depth using a 27-30G needle.',
  'botulinum': "Reconstitute with 0.9% saline; inject 0.1 mL per point using a 30-32G needle.",
  'injections': 'Restricted to licensed practitioners; administer per package insert with a 27-30G needle.',
  'anesthetics': 'Apply a thick layer under occlusion for 20-60 min; remove and start the procedure immediately.',
  'placental-therapy': 'Administer intramuscularly or via subcutaneous mesotherapy 2-3× weekly for 4-8 weeks.',
  'nano-needle-cannula': 'Sterile single-patient use; insert at the planned depth and deliver the product slowly.',
  'imported-products': "Follow the manufacturer's insert and applicable local regulations for the imported brand.",
};

// Long-template leading phrases. A protocol matching any of these is a long
// template applied by apply-protocol-templates.ts and is safe to overwrite.
const LONG_TEMPLATE_LEADS: ReadonlyArray<RegExp> = [
  /^Restricted to licensed practitioners trained in injectable techniques/i,
  /^Cleanse and disinfect the treatment area/i,
  /^Apply to clean, dry skin once or twice daily/i,
  /^For topical formulations: apply to clean, dry scalp/i,
  /^Use per product label and prescriber direction/i,
  /^Apply to clean, dry skin morning and \/ or evening/i,
  /^Intended for external V-zone application/i,
  /^Reconstitute the lyophilized powder with the supplied diluent/i,
  /^Use as part of the Curenex/i,
  /^Topical formulations: apply a thin layer to clean, dry skin in the targeted area/i,
  /^Apply per GTM product type/i,
  /^Reserved for trained operators/i,
  /^Professional spa or salon use/i,
  /^Restricted to licensed practitioners\.\s*Pre-treatment: medical history review/i,
  /^Reconstitute the lyophilized powder with 0\.9% saline/i,
  /^Restricted to licensed practitioners\.\s*Reconstitute \(if applicable\)/i,
  /^Topical surface anesthetic\./i,
  /^Restricted to licensed practitioners\.\s*Reconstitute as supplied/i,
  /^Sterile single-patient use\./i,
  /^Restricted to licensed practitioners\.\s*Follow the manufacturer/i,
];

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function isLongTemplate(s: string | undefined): boolean {
  if (!s) return false;
  return LONG_TEMPLATE_LEADS.some(re => re.test(s));
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`shorten-protocols: backup -> ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const applied: Array<{ id: number; name: string; categoryId: string }> = [];
  const skipped: Array<{ id: number; name: string; reason: string }> = [];

  for (const p of data.products) {
    const target = SHORT_TEMPLATES[p.categoryId];
    if (!target) {
      skipped.push({ id: p.id, name: p.name, reason: `no short template for ${p.categoryId}` });
      continue;
    }
    if (p.protocol === target) continue;
    if (!isLongTemplate(p.protocol)) {
      skipped.push({ id: p.id, name: p.name, reason: 'preserve (not long template)' });
      continue;
    }
    p.protocol = target;
    applied.push({ id: p.id, name: p.name, categoryId: p.categoryId });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# shorten-protocols report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`applied: ${applied.length}  skipped: ${skipped.length}`);
  lines.push('');
  lines.push(`## Applied (${applied.length})`);
  for (const a of applied) lines.push(`  #${a.id}  [${a.categoryId}]  ${a.name}`);
  lines.push('');
  lines.push(`## Skipped (${skipped.length})`);
  for (const s of skipped) lines.push(`  #${s.id}  ${s.name}  --  ${s.reason}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`shorten-protocols: applied=${applied.length} skipped=${skipped.length}`);
  console.log(`shorten-protocols: report -> ${REPORT_PATH}`);
}

main();
