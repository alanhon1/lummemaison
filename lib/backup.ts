import 'server-only';

import productsData from '@/data/products.json';
import { loadProducts, persistProducts } from '@/lib/catalogue-store';
import { createServiceClient } from '@/lib/supabase/server';
import type { Product, Category } from '@/lib/products';

// Catalogue backups live in Supabase Storage (the same `catalogue` bucket that
// holds the live products.json) so they persist on Vercel's read-only runtime.
// Each backup is an object under the `backups/` prefix; the product count is
// encoded in the filename so the dashboard can list without downloading each.
const BUCKET = 'catalogue';
const BACKUP_PREFIX = 'backups';
const MAX_BACKUPS = 3;
// products-2026-06-10T12-00-00-000Z-420p.json
const NAME_RE = /^products-[0-9A-Za-z-]+-\d+p\.json$/;

export interface BackupMeta {
  name: string;
  size: number;
  created: string; // ISO
  productCount: number;
}

// Deprecated. Was a best-effort local-filesystem snapshot taken before every
// product/category edit; now a no-op (the FS path never worked on Vercel and we
// don't want an automatic backup on every save). Manual catalogue backups go
// through createCatalogueBackup(). Kept so existing callers compile unchanged.
export function createBackup(): void {
  /* no-op — see createCatalogueBackup() */
}

// Products come from the live store (Supabase Storage); categories stay bundled.
export async function readData(): Promise<{ products: Product[]; categories: Category[] }> {
  const products = await loadProducts();
  return { products, categories: productsData.categories as Category[] };
}

// Persists product edits to the live store. Category edits are not persisted
// (categories are bundled); callers that only change products work as expected.
export async function writeData(data: { products: Product[]; categories?: Category[] }): Promise<void> {
  await persistProducts(data.products);
}

function parseCount(name: string): number {
  const m = name.match(/-(\d+)p\.json$/);
  return m ? Number(m[1]) : 0;
}

export async function listBackups(): Promise<BackupMeta[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(BACKUP_PREFIX, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (error || !data) return [];
  return data
    .filter(o => NAME_RE.test(o.name))
    .map(o => ({
      name: o.name,
      size: ((o.metadata?.size as number | undefined) ?? 0),
      created: (o.created_at as string | undefined) ?? '',
      productCount: parseCount(o.name),
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

// Keep only the MAX_BACKUPS most recent backups; delete the rest.
async function prune(): Promise<void> {
  const all = await listBackups();
  const excess = all.slice(MAX_BACKUPS);
  if (excess.length === 0) return;
  const supabase = createServiceClient();
  await supabase.storage.from(BUCKET).remove(excess.map(b => `${BACKUP_PREFIX}/${b.name}`));
}

// Snapshots the current live catalogue to a new backup object, then prunes to
// MAX_BACKUPS. Returns the new backup's filename.
export async function createCatalogueBackup(): Promise<string> {
  const products = await loadProducts();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `products-${ts}-${products.length}p.json`;
  const supabase = createServiceClient();
  const body = Buffer.from(JSON.stringify({ products }, null, 2), 'utf8');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${BACKUP_PREFIX}/${name}`, body, { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`backup failed: ${error.message}`);
  await prune();
  return name;
}

// Reads the product list out of a backup (used by the preview). Null if the
// name is invalid or the object can't be read/parsed.
export async function readBackup(name: string): Promise<Product[] | null> {
  if (!NAME_RE.test(name)) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(`${BACKUP_PREFIX}/${name}`);
  if (error || !data) return null;
  try {
    const parsed = JSON.parse(await data.text());
    const arr = Array.isArray(parsed) ? parsed : parsed.products;
    return Array.isArray(arr) ? (arr as Product[]) : null;
  } catch {
    return null;
  }
}

// Restores a backup over the live catalogue. Snapshots the CURRENT catalogue
// first (safety net) so a mistaken restore can itself be undone.
export async function restoreBackup(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!NAME_RE.test(name)) return { ok: false, error: 'Invalid backup name' };
  const products = await readBackup(name);
  if (!products) return { ok: false, error: 'Backup not found or unreadable' };
  try {
    await createCatalogueBackup();
  } catch {
    // Don't block the restore if the safety snapshot fails.
  }
  await persistProducts(products);
  return { ok: true };
}

export async function deleteBackup(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!NAME_RE.test(name)) return { ok: false, error: 'Invalid backup name' };
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([`${BACKUP_PREFIX}/${name}`]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
