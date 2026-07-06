// One-shot EMERGENCY data backup → writes a dated, local-only folder with ALL
// data (no image/binary files): the catalogue, every DB table, and auth users.
//
//   npx tsx scripts/emergency-backup.ts
//
// Output: emergency-backup-<YYYY-MM-DD>/  (gitignored — contains customer PII,
// and this repo is public, so it must NEVER be committed).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

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

const DATE = process.env.BACKUP_DATE || '2026-06-12';
const OUT = resolve(process.cwd(), `emergency-backup-${DATE}`);

// Every data table (created across the migrations). Unknown ones are skipped.
const TABLES = [
  'customer_profiles', 'orders', 'order_items', 'order_messages', 'user_messages',
  'product_stock', 'stock_movements', 'companies',
  'promo_codes', 'announcements', 'faqs', 'faq_feedback', 'feedback',
  'chat_questions', 'chat_usage', 'unanswered_questions',
  'order_attachments', 'password_reset_codes', 'admin_login_attempts',
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const s = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'tables'), { recursive: true });

  const manifest: Record<string, number | string> = { date: DATE, supabaseUrl: url };

  // 1) Catalogue (products + all product info) from Storage.
  try {
    const { data: blob } = await s.storage.from('catalogue').download('products.json');
    if (blob) {
      const txt = await blob.text();
      writeFileSync(join(OUT, 'catalogue-products.json'), txt, 'utf8');
      const parsed = JSON.parse(txt);
      manifest['catalogue-products'] = (Array.isArray(parsed) ? parsed : parsed.products).length;
    }
  } catch (e) { console.warn('catalogue:', e instanceof Error ? e.message : e); }

  // 2) Every DB table (full rows, paginated to be safe).
  for (const t of TABLES) {
    try {
      const all: unknown[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await s.from(t).select('*').range(from, from + PAGE - 1);
        if (error) { console.warn(`table ${t}: ${error.message}`); break; }
        all.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      writeFileSync(join(OUT, 'tables', `${t}.json`), JSON.stringify(all, null, 2), 'utf8');
      manifest[`table:${t}`] = all.length;
      console.log(`  ${t}: ${all.length}`);
    } catch (e) {
      console.warn(`table ${t}:`, e instanceof Error ? e.message : e);
    }
  }

  // 3) Auth users (admin API; passwords are NOT exportable — hashes stay in auth).
  try {
    const users: unknown[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) { console.warn('auth users:', error.message); break; }
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    writeFileSync(join(OUT, 'auth-users.json'), JSON.stringify(users, null, 2), 'utf8');
    manifest['auth-users'] = users.length;
    console.log(`  auth users: ${users.length}`);
  } catch (e) { console.warn('auth users:', e instanceof Error ? e.message : e); }

  manifest['generatedAt'] = new Date().toISOString();
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nEmergency backup written to: ${OUT}`);
  console.log(JSON.stringify(manifest, null, 2));
}
main();
