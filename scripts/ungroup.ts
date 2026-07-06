// Ungroup (un-merge) one or more groups in the LIVE catalogue.
//   npx tsx scripts/ungroup.ts ultra,spider,dn64
//
// Clears groupId / variantLabel / groupName / groupImage from every member of
// each given groupId, restoring them to standalone products. Use when a grouping
// turns out to merge unrelated products. Re-run `npm run apply-fake-discounts`
// afterwards so their discounts are recomputed as singletons.

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

const targets = new Set((process.argv[2] ?? '').split(',').map(s => s.trim()).filter(Boolean));
if (targets.size === 0) { console.error('Usage: tsx scripts/ungroup.ts <groupId[,groupId...]>'); process.exit(1); }

interface Product { id: number; name: string; groupId?: string; [k: string]: unknown }

async function main() {
  const sb = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: blob, error } = await sb.storage.from(BUCKET).download(OBJECT);
  if (error || !blob) { console.error('Download failed:', error?.message); process.exit(1); }
  const parsed = JSON.parse(await blob.text());
  const products: Product[] = Array.isArray(parsed) ? parsed : parsed.products;

  let cleared = 0;
  for (const p of products) {
    if (typeof p.groupId === 'string' && targets.has(p.groupId)) {
      console.log(`  ungroup #${p.id} "${p.name.trim()}" (was ${p.groupId})`);
      delete p.groupId;
      delete p.variantLabel;
      delete p.groupName;
      delete p.groupImage;
      cleared++;
    }
  }

  const out = Array.isArray(parsed) ? products : { ...parsed, products };
  const body = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
  const { error: upErr } = await sb.storage.from(BUCKET).upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1); }
  console.log(`ungroup: cleared ${cleared} products from groups [${[...targets].join(', ')}]. Now run apply-fake-discounts.`);
}

main();
