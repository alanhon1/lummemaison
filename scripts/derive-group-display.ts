/**
 * For each groupId in products.json, derive a clean group display name and
 * pick a group image. Writes groupName + groupImage back onto every product
 * in the group. Run after Phase 2 (so cleared/refilled images are settled).
 *
 * Algorithm:
 *   groupName  = longest leading uppercase token shared by every variant
 *                in the group, title-cased. Fallback: groupId title-cased.
 *   groupImage = first existing image among variants (Phase 2 may have
 *                produced a dedicated bundle photo at /images/products/
 *                group-{groupId}.webp; if so, use that instead).
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  groupName?: string;
  groupImage?: string;
}
interface DataFile { products: Product[] }

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function backupDataFile(): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `products-${stamp}.json`));
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, ch => ch.toUpperCase());
}

/** Take the longest leading-aligned uppercase token shared by all names. */
function deriveGroupName(names: string[], fallback: string): string {
  const tokenLists = names.map(n =>
    n.trim().split(/\s+/).filter(t => /^[A-Z][A-Z0-9-]*$/.test(t))
  );
  if (tokenLists.length === 0 || tokenLists.some(l => l.length === 0)) {
    return titleCase(fallback.replace(/-/g, ' '));
  }
  const shared: string[] = [];
  const maxLen = Math.min(...tokenLists.map(l => l.length));
  for (let i = 0; i < maxLen; i++) {
    const tok = tokenLists[0][i];
    if (tokenLists.every(l => l[i] === tok)) shared.push(tok);
    else break;
  }
  if (shared.length === 0) return titleCase(fallback.replace(/-/g, ' '));
  const derived = titleCase(shared.join(' '));
  if (derived.length < 3) return titleCase(fallback.replace(/-/g, ' '));
  return derived;
}

function main(): void {
  const data: DataFile = readJson<DataFile>(DATA_FILE);
  backupDataFile();

  const groups = new Map<string, Product[]>();
  for (const p of data.products) {
    if (!p.groupId) continue;
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  let touched = 0;
  for (const [groupId, members] of groups) {
    const names = members.map(m => m.name);
    const groupName = deriveGroupName(names, groupId);

    // Prefer a dedicated bundle image if one was captured
    const dedicated = `/images/products/group-${groupId}.webp`;
    const dedicatedAbs = path.join(IMAGE_DIR, `group-${groupId}.webp`);
    let groupImage = '';
    if (fs.existsSync(dedicatedAbs)) {
      groupImage = dedicated;
    } else {
      const firstWithImage = members.find(m => m.image && m.image.length > 0);
      groupImage = firstWithImage?.image ?? '';
    }

    for (const m of members) {
      m.groupName = groupName;
      m.groupImage = groupImage;
      touched++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Set groupName/groupImage on ${touched} product(s) across ${groups.size} group(s).`);
}

main();
