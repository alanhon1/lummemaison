/**
 * Delete BARBIE SLIM (id 1) and renumber all remaining products to
 * 1..N contiguous. Renames image files on disk, updates categories
 * ranges, re-keys translations, and re-composes bundle covers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { composeBundleCover } from '../lib/compose-bundle-cover';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const PRODUCTS_IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const TRANSLATIONS_DIR = path.join(ROOT, 'data', 'translations');
const REPORT_PATH = path.join(ROOT, 'scripts', 'renumber-products-report.txt');

interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
  groupId?: string;
  groupImage?: string;
  [k: string]: unknown;
}
interface Category {
  id: string;
  name: string;
  range: [number, number];
}
interface DataFile { products: Product[]; categories: Category[] }

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

const EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.avif', '.gif'];

function stripQueryString(url: string): string {
  return url.split('?')[0];
}

function renameImageFiles(oldId: number, newId: number): { renamed: string[]; errors: string[] } {
  const renamed: string[] = [];
  const errors: string[] = [];
  for (const ext of EXTS) {
    const oldPath = path.join(PRODUCTS_IMG_DIR, `product-${oldId}${ext}`);
    if (!fs.existsSync(oldPath)) continue;
    const newPath = path.join(PRODUCTS_IMG_DIR, `product-${newId}${ext}`);
    // If old==new skip
    if (oldPath === newPath) {
      renamed.push(`product-${oldId}${ext} (no-op)`);
      continue;
    }
    try {
      // If target exists, remove it first (shouldn't happen after the
      // renumber pass picks unique new ids).
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      fs.renameSync(oldPath, newPath);
      renamed.push(`product-${oldId}${ext} -> product-${newId}${ext}`);
    } catch (err) {
      errors.push(`product-${oldId}${ext}: ${(err as Error).message}`);
    }
  }
  // Also handle versioned files: product-{id}-{ts}.webp
  const versionedPrefix = `product-${oldId}-`;
  try {
    const files = fs.readdirSync(PRODUCTS_IMG_DIR).filter(f => f.startsWith(versionedPrefix));
    for (const f of files) {
      const suffix = f.slice(versionedPrefix.length);
      const newPath = path.join(PRODUCTS_IMG_DIR, `product-${newId}-${suffix}`);
      const oldPath = path.join(PRODUCTS_IMG_DIR, f);
      try {
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
        fs.renameSync(oldPath, newPath);
        renamed.push(`${f} -> product-${newId}-${suffix}`);
      } catch (err) {
        errors.push(`${f}: ${(err as Error).message}`);
      }
    }
  } catch { /* ignore */ }
  return { renamed, errors };
}

function rewriteImagePath(image: string | undefined, oldId: number, newId: number): string {
  if (!image) return '';
  const clean = stripQueryString(image);
  // Match /images/products/product-{oldId}.ext or product-{oldId}-{ts}.ext
  const re = new RegExp(`/images/products/product-${oldId}(?=[-.])`);
  return clean.replace(re, `/images/products/product-${newId}`);
}

async function main(): Promise<void> {
  const backupPath = backupDataFile();
  console.log(`renumber-products: backup -> ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  // Step 1: delete BARBIE SLIM id 1.
  const targetIdx = data.products.findIndex(p => p.id === 1 && /^BARBIE\s+SLIM/i.test(p.name));
  if (targetIdx === -1) {
    console.error('Could not find BARBIE SLIM at id 1 — aborting.');
    process.exit(1);
  }
  const deletedName = data.products[targetIdx].name;
  data.products.splice(targetIdx, 1);
  console.log(`renumber-products: deleted #1 ${deletedName}`);

  // Step 2: sort remaining products by current id (preserves catalogue order).
  data.products.sort((a, b) => a.id - b.id);

  // Step 3: build id map and renumber 1..N.
  const idMap = new Map<number, number>();
  data.products.forEach((p, idx) => {
    const newId = idx + 1;
    if (p.id !== newId) idMap.set(p.id, newId);
  });
  console.log(`renumber-products: renumbering ${idMap.size} products`);

  // Step 4: rename image files on disk. Do this in a temp-stage:
  //   first move every old file to product-tmp-{oldId}.ext
  //   then move tmp to final new id.
  // Avoids id conflicts when one product's new_id collides with another's old_id.
  const renameLog: Array<{ from: string; to: string }> = [];
  const renameErrors: string[] = [];

  // Stage 1: rename to .tmp- prefix
  for (const [oldId] of idMap) {
    for (const ext of EXTS) {
      const src = path.join(PRODUCTS_IMG_DIR, `product-${oldId}${ext}`);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(PRODUCTS_IMG_DIR, `product-tmp${oldId}${ext}`);
      try {
        fs.renameSync(src, dst);
      } catch (err) {
        renameErrors.push(`stage1 product-${oldId}${ext}: ${(err as Error).message}`);
      }
    }
    // Versioned files
    const versionedPrefix = `product-${oldId}-`;
    try {
      const files = fs.readdirSync(PRODUCTS_IMG_DIR).filter(f =>
        f.startsWith(versionedPrefix) && !f.startsWith('product-tmp')
      );
      for (const f of files) {
        const suffix = f.slice(versionedPrefix.length);
        const src = path.join(PRODUCTS_IMG_DIR, f);
        const dst = path.join(PRODUCTS_IMG_DIR, `product-tmp${oldId}-${suffix}`);
        try { fs.renameSync(src, dst); } catch (err) {
          renameErrors.push(`stage1 ${f}: ${(err as Error).message}`);
        }
      }
    } catch { /* ignore */ }
  }

  // Stage 2: tmp -> final new id
  for (const [oldId, newId] of idMap) {
    for (const ext of EXTS) {
      const src = path.join(PRODUCTS_IMG_DIR, `product-tmp${oldId}${ext}`);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(PRODUCTS_IMG_DIR, `product-${newId}${ext}`);
      try {
        fs.renameSync(src, dst);
        renameLog.push({ from: `product-${oldId}${ext}`, to: `product-${newId}${ext}` });
      } catch (err) {
        renameErrors.push(`stage2 product-${oldId}${ext}: ${(err as Error).message}`);
      }
    }
    // Versioned
    const tmpPrefix = `product-tmp${oldId}-`;
    try {
      const files = fs.readdirSync(PRODUCTS_IMG_DIR).filter(f => f.startsWith(tmpPrefix));
      for (const f of files) {
        const suffix = f.slice(tmpPrefix.length);
        const src = path.join(PRODUCTS_IMG_DIR, f);
        const dst = path.join(PRODUCTS_IMG_DIR, `product-${newId}-${suffix}`);
        try {
          fs.renameSync(src, dst);
          renameLog.push({ from: f, to: `product-${newId}-${suffix}` });
        } catch (err) {
          renameErrors.push(`stage2 ${f}: ${(err as Error).message}`);
        }
      }
    } catch { /* ignore */ }
  }

  // Step 5: update id fields + image path references.
  for (const p of data.products) {
    const oldId = p.id;
    const newId = idMap.get(oldId) ?? oldId;
    if (oldId !== newId) p.id = newId;
    // Image path: always reference the new id (regardless of whether it changed).
    if (typeof p.image === 'string' && p.image) {
      // Find the id encoded in the path (it may match oldId).
      const m = stripQueryString(p.image).match(/\/images\/products\/product-(\d+)(?=[-.])/);
      if (m) {
        const pathId = parseInt(m[1], 10);
        const newPathId = idMap.get(pathId) ?? pathId;
        p.image = stripQueryString(p.image).replace(/\/images\/products\/product-\d+/, `/images/products/product-${newPathId}`);
      }
    }
  }

  // Step 6: update categories ranges from new product ids.
  for (const cat of data.categories) {
    const inCat = data.products.filter(p => p.categoryId === cat.id);
    if (inCat.length === 0) {
      cat.range = [0, 0];
      continue;
    }
    const ids = inCat.map(p => p.id);
    cat.range = [Math.min(...ids), Math.max(...ids)];
  }

  // Step 7: re-compose bundle covers (groupImage paths reference products
  // with the new ids; the compositor will read the new image paths).
  const byGroup = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    const list = byGroup.get(p.groupId) ?? [];
    list.push(p);
    byGroup.set(p.groupId, list);
  }
  const composedGroups: string[] = [];
  for (const [groupId, members] of byGroup) {
    if (members.length < 2) {
      // Clear group meta for singletons.
      for (const m of members) {
        delete m.groupId;
        delete m.variantLabel;
        delete m.groupName;
        delete m.groupImage;
      }
      continue;
    }
    try {
      const { outputPath } = await composeBundleCover(groupId, members);
      const versioned = `${outputPath}?v=${Date.now()}`;
      for (const m of members) m.groupImage = versioned;
      composedGroups.push(groupId);
    } catch (err) {
      renameErrors.push(`bundle ${groupId}: ${(err as Error).message}`);
    }
  }

  // Step 8: write products.json.
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Step 9: re-key translations.
  for (const fname of ['ru.json', 'ko.json']) {
    const p = path.join(TRANSLATIONS_DIR, fname);
    if (!fs.existsSync(p)) continue;
    const t = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(t)) {
      const oldId = parseInt(k, 10);
      if (Number.isNaN(oldId)) { next[k] = v; continue; }
      if (oldId === 1) continue; // BARBIE SLIM removed
      const newId = idMap.get(oldId) ?? oldId;
      next[String(newId)] = v;
    }
    fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n', 'utf8');
  }

  // Report.
  const lines: string[] = [];
  lines.push('# renumber-products report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`deleted: id 1 ${deletedName}`);
  lines.push(`renumbered: ${idMap.size}`);
  lines.push(`final product count: ${data.products.length}`);
  lines.push(`image renames: ${renameLog.length}`);
  lines.push(`rename errors: ${renameErrors.length}`);
  lines.push(`bundles re-composed: ${composedGroups.length}`);
  lines.push('');
  lines.push('## Id map (sample first 20)');
  let i = 0;
  for (const [o, n] of idMap) {
    if (i++ >= 20) break;
    lines.push(`  ${o} -> ${n}`);
  }
  if (renameErrors.length > 0) {
    lines.push('');
    lines.push('## Rename errors');
    for (const e of renameErrors) lines.push(`  ${e}`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`renumber-products: ${data.products.length} products, ${renameLog.length} files renamed, ${renameErrors.length} errors`);
  console.log(`renumber-products: report -> ${REPORT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
