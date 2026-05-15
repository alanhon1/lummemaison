/**
 * Groups variant products by their shared aesthetics-shop.com slug.
 *
 * Usage:
 *   npx tsx scripts/group-products.ts
 *
 * Writes groupId + variantLabel to data/products.json for products
 * where 2+ of our items map to the same aesthetics-shop.com product.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const SITEMAP_URL = 'https://aesthetics-shop.com/product-sitemap.xml';
const MIN_SCORE = 2;

interface AestheticsProduct {
  slug: string;
  name: string;
}

interface Product {
  id: number;
  name: string;
  groupId?: string;
  variantLabel?: string;
}

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(\d+)\s*u\b/g, '$1')
    .replace(/\bunits?\b/g, '')
    .replace(/\bwith\b/g, '')
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = b.split(' ').filter(w => w.length > 1);
  let score = 0;
  for (const w of wb) {
    if (wa.has(w)) score += w.length > 3 ? 2 : 1;
  }
  return score;
}

function extractVariantLabel(productName: string, allNamesInGroup: string[]): string {
  const words = productName.trim().toUpperCase().split(/\s+/);
  const commonWords = new Set(
    words.filter(w => allNamesInGroup.every(n => n.toUpperCase().split(/\s+/).includes(w)))
  );
  const unique = words.filter(w => !commonWords.has(w));
  const raw = unique.join(' ') || productName.trim();
  // Strip annotation suffixes that don't describe the variant
  return raw
    .replace(/\(CE\)/gi, '')
    .replace(/\bNO\s+LIDOCAINE\b/gi, '')
    .replace(/\bWITH\s+LIDOCAINE\b/gi, '')
    .replace(/\bLIDOCAINE\b/gi, '')
    .replace(/\bNO\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSitemap(): Promise<AestheticsProduct[]> {
  console.log('Fetching sitemap…');
  const res = await axios.get<string>(SITEMAP_URL, { timeout: 30_000 });
  const xml = res.data;
  const products: AestheticsProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(?:<!\[CDATA\[)?(https:\/\/aesthetics-shop\.com\/product\/([^\]<]+?)\/??)(?:\]\]>)?<\/loc>/);
    if (!locMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');
    products.push({ slug, name: slug.replace(/-/g, ' ') });
  }

  console.log(`Parsed ${products.length} products from sitemap.`);
  return products;
}

async function main() {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  // Clear any previously set groupId/variantLabel so re-runs are clean
  for (const p of allProducts) {
    delete p.groupId;
    delete p.variantLabel;
  }

  let aestheticsProducts: AestheticsProduct[];
  try {
    aestheticsProducts = await fetchSitemap();
  } catch (err) {
    console.error('Failed to fetch sitemap:', err);
    process.exit(1);
  }

  const normMap = aestheticsProducts.map(p => ({ norm: normalise(p.name), slug: p.slug }));

  // Map each product to its best-matching aesthetics-shop.com slug
  const slugForProduct = new Map<number, string>();
  for (const p of allProducts) {
    const normName = normalise(p.name);
    const scored = normMap
      .map(({ norm, slug }) => ({ score: scoreMatch(normName, norm), slug }))
      .filter(x => x.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      slugForProduct.set(p.id, scored[0].slug);
    }
  }

  // Group products by their matched slug
  const slugToIds = new Map<string, number[]>();
  for (const [id, slug] of slugForProduct) {
    const list = slugToIds.get(slug) ?? [];
    list.push(id);
    slugToIds.set(slug, list);
  }

  // Only groups with 2+ members become variant groups
  // AND all members must share the same first word (brand name guard)
  let groupCount = 0;
  let variantProductCount = 0;
  let falsePositiveCount = 0;

  for (const [slug, ids] of slugToIds) {
    if (ids.length < 2) continue;

    const groupMembers = allProducts.filter(p => ids.includes(p.id));
    const groupNames = groupMembers.map(p => p.name);

    // Validate: all products must share the same first normalised word
    // (e.g. all start with "SOSUM", "REGENOVUE", "NEURAMIS" etc.)
    // This prevents false grouping of unrelated brands that share a descriptor word
    const firstWords = groupMembers.map(p => normalise(p.name).split(' ')[0]);
    const allSameFirstWord = firstWords.every(w => w === firstWords[0]);

    if (!allSameFirstWord) {
      falsePositiveCount++;
      continue;
    }

    groupCount++;
    for (const p of groupMembers) {
      const idx = allProducts.findIndex(x => x.id === p.id);
      allProducts[idx].groupId = slug;
      allProducts[idx].variantLabel = extractVariantLabel(p.name, groupNames);
      variantProductCount++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone. ${groupCount} valid groups, ${variantProductCount} products assigned groupId. (${falsePositiveCount} mixed-brand false-positives skipped)`);

  console.log('\nSample valid groups:');
  let shown = 0;
  for (const [slug, ids] of slugToIds) {
    if (ids.length < 2 || shown >= 8) continue;
    const members = allProducts.filter(p => ids.includes(p.id) && p.groupId === slug);
    if (members.length === 0) continue; // was rejected
    const names = members.map(p => `  ${p.name} → "${p.variantLabel}"`);
    console.log(`[${slug}]`);
    names.forEach(n => console.log(n));
    shown++;
  }
}

main();
