// Group still-ungrouped same-line products in the LIVE catalogue.
//   npx tsx scripts/group-ungrouped.ts          # preview only
//   npx tsx scripts/group-ungrouped.ts --apply  # write to the live store
//
// Buckets ungrouped, priced products by (categoryId, brand key = first 1–2
// name words, case-insensitive) and turns each cluster of 2+ into a variant
// group: sets groupId, variantLabel (name minus the shared leading words) and
// groupName. Mirrors scripts/extend-grouping.ts but is case-insensitive (so
// mixed-case brands like "Domina", "Sungshim" are caught too) and runs on the
// live Supabase Storage object instead of the stale bundled file.
//
// After grouping, re-run `npm run apply-fake-discounts` so within-$1 members of
// each new group share one "was" price.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotEnv('.env.local');
loadDotEnv('.env');

const BUCKET = 'catalogue';
const OBJECT = 'products.json';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env.'); process.exit(1); }

const apply = process.argv.includes('--apply');

// Words too generic to anchor a brand key on their own → fall back to two words.
const STOP = new Set(['the', 'for', 'with', 'and', 'mis', 'neo', 'dr', 'dk', 'jbp', 'line', 'skin', 'gold', 'plla', 'pdrn', 'vita']);

interface Product {
  id: number;
  name: string;
  categoryId: string;
  groupId?: string;
  variantLabel?: string;
  groupName?: string;
  [k: string]: unknown;
}

function norm(s: string): string {
  return s.replace(/\(.*?\)/g, ' ').trim().toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function brandKey(name: string): string | null {
  const w = norm(name).split(' ').filter(Boolean);
  if (!w.length) return null;
  let key = w[0];
  if (key.length < 3 || STOP.has(key)) key = w.slice(0, 2).join(' ');
  return key.length >= 4 ? key : null;
}
// Leading words shared (case-insensitively) by every name in the group.
function commonLeading(names: string[]): string[] {
  const toks = names.map(n => n.replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean));
  const min = Math.min(...toks.map(t => t.length));
  const out: string[] = [];
  for (let i = 0; i < min; i++) {
    const w = toks[0][i].toLowerCase();
    if (toks.every(t => t[i].toLowerCase() === w)) out.push(toks[0][i]);
    else break;
  }
  return out;
}
function variantLabelFor(name: string, leadCount: number): string {
  const stripped = name.trim().split(/\s+/).slice(leadCount).join(' ').trim();
  return stripped || name.trim();
}

async function main() {
  const sb = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: blob, error } = await sb.storage.from(BUCKET).download(OBJECT);
  if (error || !blob) { console.error('Download failed:', error?.message); process.exit(1); }
  const parsed = JSON.parse(await blob.text());
  const products: Product[] = Array.isArray(parsed) ? parsed : parsed.products;

  const existingSlugs = new Set(products.map(p => p.groupId).filter((g): g is string => !!g));

  // Bucket ALL priced products by brand key, CATEGORY-INDEPENDENT — so a line
  // split across site categories (e.g. HANHEAL in mesotherapy + hair-treatment)
  // unifies into one group.
  const buckets = new Map<string, Product[]>();
  for (const p of products) {
    if (!(typeof p.price === 'number') || (p.price as number) <= 0) continue;
    const k = brandKey(p.name);
    if (!k) continue;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p);
  }

  let groupsCreated = 0;
  let joined = 0;
  let ambiguous = 0;
  let productsGrouped = 0;
  const report: string[] = [];
  for (const [k, members] of buckets) {
    if (members.length < 2) continue;
    const ungrouped = members.filter(m => !m.groupId);
    if (ungrouped.length === 0) continue; // already fully grouped
    const gids = [...new Set(members.map(m => m.groupId).filter((g): g is string => !!g))];
    if (gids.length > 1) { ambiguous++; report.push(`~ SKIP "${k}" — spans multiple groups (${gids.join(', ')})`); continue; }
    const lead = commonLeading(members.map(m => m.name));
    let gid: string;
    let groupName: string;
    if (gids.length === 1) {
      // Join the existing group (assign only the ungrouped stragglers).
      gid = gids[0];
      groupName = members.find(m => m.groupId === gid && m.groupName)?.groupName ?? (lead.join(' ') || k);
      report.push(`+ JOIN ${gid} ("${groupName}") <- ${ungrouped.length}`);
      joined++;
    } else {
      gid = slugify(k);
      let n = 2;
      while (existingSlugs.has(gid)) gid = `${slugify(k)}-${n++}`;
      existingSlugs.add(gid);
      groupName = lead.join(' ') || k;
      report.push(`• NEW ${gid} ("${groupName}") — ${members.length}`);
      groupsCreated++;
    }
    for (const p of ungrouped.sort((a, b) => a.id - b.id)) {
      const label = variantLabelFor(p.name, lead.length);
      report.push(`    #${p.id} $${p.price}  "${p.name.trim()}"  ->  "${label}"`);
      if (apply) {
        p.groupId = gid;
        p.variantLabel = label;
        p.groupName = groupName;
      }
      productsGrouped++;
    }
  }

  console.log(`group-ungrouped: ${groupsCreated} new groups, ${joined} joins, ${ambiguous} skipped(ambiguous), ${productsGrouped} products ${apply ? '(APPLIED)' : '(preview — pass --apply to write)'}`);
  console.log(report.join('\n'));

  if (apply) {
    const out = Array.isArray(parsed) ? products : { ...parsed, products };
    const body = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
    const { error: upErr } = await sb.storage.from(BUCKET).upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
    if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1); }
    console.log('group-ungrouped: uploaded. Now run `npm run apply-fake-discounts` to re-cluster discounts.');
  }
}

main();
