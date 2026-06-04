import 'server-only';

import fs from 'fs';
import path from 'path';
import productsData from '@/data/products.json';
import { loadProducts, persistProducts } from '@/lib/catalogue-store';
import type { Product, Category } from '@/lib/products';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 30;

// Best-effort local backup of the bundled file. No-ops on read-only runtimes
// (e.g. Vercel) — the product store keeps history server-side and never depends
// on this. Never throws.
export function createBackup(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_DIR, `products-${timestamp}.json`);
    fs.copyFileSync(DATA_FILE, dest);

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    files.slice(MAX_BACKUPS).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* ignore */ }
    });
  } catch {
    // Read-only filesystem (production) — backups are local-dev only.
  }
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
