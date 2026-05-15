import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const LUMEEMASON_DIR = path.join(process.cwd(), 'lumeemasonpic', 'catalogue', 'categories');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'image-sync-report.txt');

// Maps category folder name → products.json categoryId
const CAT_FOLDER_MAP: Record<string, string> = {
  'catalogue-categories-fillers': 'fillers',
  'catalogue-categories-mesotherapy-biorevitalization': 'mesotherapy',
  'catalogue-categories-acne-treatment': 'acne-treatment',
  'catalogue-categories-hair-treatment': 'hair-treatment',
  'catalogue-categories-pharmacy-favourites': 'pharmacy-favourites',
  'catalogue-categories-topical-cosmetics': 'topical-cosmetics',
  'catalogue-categories-intimate-care': 'intimate-care',
  'catalogue-categories-growth-factor-exosome': 'growth-factor-exosome',
  'catalogue-categories-curenex': 'curenex',
  'catalogue-categories-dermagen': 'dermagen',
  'catalogue-categories-gtm': 'gtm',
  'catalogue-categories-equipment': 'equipment',
  'catalogue-categories-salon-grade': 'salon-grade',
  'catalogue-categories-lipolytics': 'lipolytics',
  'catalogue-categories-botulinum-therapy': 'botulinum',
  'catalogue-categories-injections': 'injections',
  'catalogue-categories-anesthetics': 'anesthetics',
  'catalogue-categories-placental-therapy': 'placental-therapy',
  'catalogue-categories-nano-needle-cannula': 'nano-needle-cannula',
  'catalogue-categories-imported-products': 'imported-products',
};

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Score how well an image filename matches a product slug.
// +2 for exact word match, +1 for substring match.
function scoreImage(imagePath: string, productSlug: string): number {
  const base = path.basename(imagePath, path.extname(imagePath));
  const imgSlug = nameToSlug(base);
  const imgWords = imgSlug.split('-');
  const productWords = productSlug.split('-').filter(w => w.length > 2);
  let score = 0;
  for (const word of productWords) {
    if (imgWords.includes(word)) score += 2;
    else if (imgSlug.includes(word)) score += 1;
  }
  return score;
}

type MatchType = 'exact' | 'prefix' | 'word-match' | 'fallback';

interface MatchResult {
  sourcePath: string;
  matchType: MatchType;
}

function findBestImage(
  productSlug: string,
  brandMap: Map<string, string[]>
): MatchResult | null {
  // 1. Exact brand-folder name match
  if (brandMap.has(productSlug)) {
    const images = brandMap.get(productSlug)!;
    const best = [...images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return { sourcePath: best, matchType: 'exact' };
  }

  // 2. Product slug begins with a known brand slug
  // e.g. "regenovue-fine-plus-ce" → brand "regenovue"
  let prefixMatch: { images: string[]; brandLen: number } | null = null;
  for (const [brand, images] of brandMap) {
    if (productSlug === brand || productSlug.startsWith(brand + '-')) {
      if (!prefixMatch || brand.length > prefixMatch.brandLen) {
        prefixMatch = { images, brandLen: brand.length };
      }
    }
  }
  if (prefixMatch) {
    const best = [...prefixMatch.images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return { sourcePath: best, matchType: 'prefix' };
  }

  // 3. Brand folder that shares the most words with the product slug
  const productWords = new Set(productSlug.split('-').filter(w => w.length > 2));
  let bestWordMatch: { images: string[]; overlap: number } | null = null;
  for (const [brand, images] of brandMap) {
    const brandWords = brand.split('-').filter(w => w.length > 2);
    const overlap = brandWords.filter(w => productWords.has(w)).length;
    if (overlap >= 1 && (!bestWordMatch || overlap > bestWordMatch.overlap)) {
      bestWordMatch = { images, overlap };
    }
  }
  if (bestWordMatch) {
    const best = [...bestWordMatch.images].sort((a, b) => scoreImage(b, productSlug) - scoreImage(a, productSlug))[0];
    return {
      sourcePath: best,
      matchType: bestWordMatch.overlap >= 2 ? 'word-match' : 'fallback',
    };
  }

  return null;
}

interface Product {
  id: number;
  name: string;
  categoryId: string;
  image: string;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Product[];

  // Build imageMap: categoryId → Map<brandSlug, absoluteImagePaths[]>
  const imageMap = new Map<string, Map<string, string[]>>();
  for (const [folder, catId] of Object.entries(CAT_FOLDER_MAP)) {
    const catPath = path.join(LUMEEMASON_DIR, folder);
    if (!fs.existsSync(catPath)) continue;
    const brandMap = new Map<string, string[]>();
    for (const entry of fs.readdirSync(catPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const brandPath = path.join(catPath, entry.name);
      const images = fs.readdirSync(brandPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => path.join(brandPath, f));
      if (images.length) brandMap.set(entry.name, images);
    }
    imageMap.set(catId, brandMap);
  }

  const matched: string[] = [];
  const fallbacks: string[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    const brandMap = imageMap.get(p.categoryId);
    if (!brandMap) {
      unmatched.push(`#${p.id} ${p.name} (no category folder for "${p.categoryId}")`);
      process.stdout.write(`${prefix} ✗ ${p.name} — no category folder\n`);
      continue;
    }

    const productSlug = nameToSlug(p.name);
    const result = findBestImage(productSlug, brandMap);

    if (!result) {
      unmatched.push(`#${p.id} ${p.name} (slug: "${productSlug}", no brand match)`);
      process.stdout.write(`${prefix} ✗ ${p.name} — no match\n`);
      continue;
    }

    const ext = path.extname(result.sourcePath).toLowerCase();
    const destFilename = `product-${p.id}${ext}`;
    const destPath = path.join(OUTPUT_DIR, destFilename);
    fs.copyFileSync(result.sourcePath, destPath);
    data.products[i].image = `/images/products/${destFilename}`;

    const relSrc = path.relative(process.cwd(), result.sourcePath).replace(/\\/g, '/');
    const logLine = `#${p.id} ${p.name} ← ${relSrc} [${result.matchType}]`;

    if (result.matchType === 'fallback') {
      fallbacks.push(logLine);
    } else {
      matched.push(logLine);
    }

    process.stdout.write(`${prefix} ✓ ${p.name} (${result.matchType})\n`);

    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== MATCHED (${matched.length}) ===`,
    ...matched,
    '',
    `=== FALLBACK / AMBIGUOUS (${fallbacks.length}) ===`,
    ...fallbacks,
    '',
    `=== UNMATCHED — kept existing image (${unmatched.length}) ===`,
    ...unmatched,
  ].join('\n');

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  process.stdout.write(`\nDone. Matched: ${matched.length}, Fallback: ${fallbacks.length}, Unmatched: ${unmatched.length}\n`);
  process.stdout.write(`Full report: scripts/image-sync-report.txt\n`);
}

main();
