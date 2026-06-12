// Sets the purchase `options` (needle lengths) on REJUBEAU products by parsing
// the mm tokens from each product's specification.
//   npx tsx scripts/set-rejubeau-options.ts          # preview
//   npx tsx scripts/set-rejubeau-options.ts --apply  # write + bust cache
//
// e.g. spec "(4mm/6mm/13mm), 100 pcs" -> options ['4mm','6mm','13mm'];
//      spec "4mm, 100 pcs"            -> options ['4mm'].

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotEnv('.env.local'); loadDotEnv('.env');

const BUCKET = 'catalogue';
const OBJECT = 'products.json';
const APPLY = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function lengthsFromSpec(spec: string): string[] {
  const m = String(spec || '').match(/\d+mm/gi) ?? [];
  return [...new Set(m.map(s => s.toLowerCase()))];
}

async function main() {
  const s = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: blob, error } = await s.storage.from(BUCKET).download(OBJECT);
  if (error || !blob) { console.error('download failed', error?.message); process.exit(1); }
  const parsed = JSON.parse(await blob.text());
  const products: any[] = Array.isArray(parsed) ? parsed : parsed.products;

  let changed = 0;
  for (const p of products) {
    const isRej = /rejubeau/i.test(p.name) || /rejubeau/i.test(p.groupName ?? '');
    if (!isRej) continue;
    const opts = lengthsFromSpec(p.specification);
    if (opts.length === 0) { console.log(`#${p.id} ${p.name}: no mm in spec "${p.specification}" — skipped`); continue; }
    const before = JSON.stringify(p.options ?? null);
    if (before === JSON.stringify(opts)) { console.log(`#${p.id} ${p.name}: already ${JSON.stringify(opts)}`); continue; }
    p.options = opts;
    changed++;
    console.log(`#${p.id} ${p.name}: options = ${JSON.stringify(opts)}`);
  }

  if (!APPLY) { console.log(`\n(PREVIEW) ${changed} would change. Re-run with --apply.`); return; }
  if (changed === 0) { console.log('nothing to change.'); return; }

  const out = Array.isArray(parsed) ? products : { ...parsed, products };
  const { error: upErr } = await s.storage.from(BUCKET).upload(OBJECT, Buffer.from(JSON.stringify(out, null, 2), 'utf8'), { upsert: true, contentType: 'application/json' });
  if (upErr) { console.error('upload failed', upErr.message); process.exit(1); }
  console.log(`\nApplied: ${changed} products updated.`);

  const secret = process.env.REVALIDATE_SECRET?.trim();
  const target = (process.env.REVALIDATE_URL || 'https://www.lumeemaison.com').replace(/\/$/, '');
  if (secret) {
    try {
      const r = await fetch(`${target}/api/revalidate`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret }, body: JSON.stringify({ tag: 'catalogue' }) });
      console.log(`cache bust HTTP ${r.status}`);
    } catch (e) { console.log('cache bust skipped', e instanceof Error ? e.message : ''); }
  }
}
main();
