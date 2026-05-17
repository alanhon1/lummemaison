/**
 * For every Lumière product with empty image OR weak description (<50 chars),
 * fuzzy-match against gofillerss and stage a candidate. Writes:
 *   - public/images/products/product-{id}-secondary.webp  (staging images)
 *   - scripts/secondary-candidates.json                   (manifest)
 *
 * Does NOT mutate data/products.json. Phase 2's vision-verification step
 * (Task 7) decides what gets promoted.
 *
 * Also tries to fetch a description from the candidate's product page via
 * Shopify's product JSON endpoint (/products/{slug}.json).
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

import { normalise, scoreMatch } from './lib/fuzzy-match';
import { fetchAllGofillerssProducts, GofillerssProduct } from './sync-from-gofillerss';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const CANDIDATES_FILE = path.join(process.cwd(), 'scripts', 'secondary-candidates.json');
const MIN_SCORE = 2;
const MIN_DESC_LEN = 50;
const DELAY_MS = 800;

interface Product {
  id: number;
  name: string;
  image: string;
  description: string;
  images?: string[];
}
interface Candidate {
  id: number;
  productName: string;
  matchedSlug: string;
  matchedName: string;
  matchScore: number;
  stagingImagePath: string;
  candidateDescription: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function downloadAndStage(url: string, productId: number): Promise<string> {
  const stagingName = `product-${productId}-secondary.webp`;
  const stagingPath = path.join(IMAGE_DIR, stagingName);
  const res = await axios.get<ArrayBuffer>(url, {
    timeout: 30_000,
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  await sharp(Buffer.from(res.data))
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(stagingPath);
  return `/images/products/${stagingName}`;
}

async function fetchShopifyDescription(slug: string): Promise<string> {
  try {
    const res = await axios.get<{ product?: { body_html?: string } }>(
      `https://mg.gofillerss.com/products/${slug}.json`,
      { timeout: 20_000 }
    );
    const html = res.data.product?.body_html ?? '';
    // Strip tags, collapse whitespace, take first 300 chars
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

function bestMatch(product: Product, source: GofillerssProduct[]): { entry: GofillerssProduct; score: number } | null {
  const target = normalise(product.name);
  let best: { entry: GofillerssProduct; score: number } | null = null;
  for (const src of source) {
    const score = scoreMatch(target, normalise(src.name));
    if (score >= MIN_SCORE && (best === null || score > best.score)) {
      best = { entry: src, score };
    }
  }
  return best;
}

async function main(): Promise<void> {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('Fetching gofillerss sitemap…');
  const source = await fetchAllGofillerssProducts();
  console.log(`Got ${source.length} gofillerss products.`);

  const needsRefill = data.products.filter(p =>
    !p.image || p.image.length === 0 || !p.description || p.description.length < MIN_DESC_LEN
  );
  console.log(`${needsRefill.length} products need refill.`);

  const candidates: Candidate[] = [];
  let processed = 0;

  for (const p of needsRefill) {
    processed++;
    const match = bestMatch(p, source);
    if (!match) {
      console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: NO MATCH`);
      continue;
    }

    let stagingImagePath = '';
    if (!p.image || p.image.length === 0) {
      try {
        stagingImagePath = await downloadAndStage(match.entry.imageUrl, p.id);
      } catch (err) {
        console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: IMAGE DOWNLOAD FAILED — ${(err as Error).message}`);
      }
    }

    let candidateDescription = '';
    if (!p.description || p.description.length < MIN_DESC_LEN) {
      candidateDescription = await fetchShopifyDescription(match.entry.slug);
    }

    candidates.push({
      id: p.id,
      productName: p.name,
      matchedSlug: match.entry.slug,
      matchedName: match.entry.name,
      matchScore: match.score,
      stagingImagePath,
      candidateDescription,
    });

    console.log(`[${processed}/${needsRefill.length}] #${p.id} ${p.name}: matched "${match.entry.slug}" (score ${match.score})${stagingImagePath ? ' + img' : ''}${candidateDescription ? ' + desc' : ''}`);
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2), 'utf8');
  console.log(`Wrote ${candidates.length} candidates to ${CANDIDATES_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
