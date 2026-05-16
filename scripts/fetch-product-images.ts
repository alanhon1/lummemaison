import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const MISSING_FILE = path.join(process.cwd(), 'public', 'missing-images.txt');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Watermarked stock photo domains — never use images from these
const WATERMARK_DOMAINS = [
  'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'istock.com',
  'depositphotos.com', 'alamy.com', 'stock.adobe.com', 'dreamstime.com',
  '123rf.com', 'fotolia.com', 'bigstockphoto.com', 'canstockphoto.com',
  'stockphoto.com', 'vectorstock.com', 'pond5.com', 'offset.com',
];

function isWatermarked(url: string): boolean {
  const u = url.toLowerCase();
  if (WATERMARK_DOMAINS.some(d => u.includes(d))) return true;
  // Typical stock photo URL patterns
  if (/\/comp\/|\/preview\/|watermark|_preview\.|_watermark\./.test(u)) return true;
  return false;
}

// Category → search context
const CATEGORY_TERMS: Record<string, string> = {
  fillers: 'hyaluronic acid dermal filler',
  mesotherapy: 'mesotherapy serum injection',
  'acne-treatment': 'acne treatment skincare',
  'hair-treatment': 'hair treatment injection PRP',
  'pharmacy-favourites': 'pharmaceutical skincare',
  'topical-cosmetics': 'topical cosmetic cream',
  'intimate-care': 'intimate care product',
  'growth-factor-exosome': 'exosome growth factor skin',
  curenex: 'aesthetic filler injection',
  dermagen: 'dermal aesthetic injection',
  gtm: 'aesthetic medical product',
  equipment: 'medical aesthetic device',
  'salon-grade': 'professional salon cosmetic',
  lipolytics: 'lipolytic fat dissolving injection',
  botulinum: 'botulinum toxin aesthetic',
  injections: 'injectable aesthetic treatment',
  anesthetics: 'topical anesthetic cream',
  'placental-therapy': 'placental extract injection',
  'nano-needle-cannula': 'medical needle cannula',
  'imported-products': 'aesthetic medical product',
};

async function searchBingImages(query: string): Promise<string[]> {
  try {
    const res = await axios.get('https://www.bing.com/images/search', {
      params: { q: query, FORM: 'HDRSC2' },
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 12000,
    });
    const decoded = res.data.replace(/&quot;/g, '"');
    const matches = [...decoded.matchAll(/"murl":"(https?:[^"]+)"/g)];
    return matches.map(m => m[1]);
  } catch { return []; }
}

// Strict match: the main brand keyword must appear in the image URL
function strictUrlMatch(imageUrl: string, keywords: string[]): boolean {
  const url = imageUrl.toLowerCase();
  // The longest keyword (brand name) must be in the URL
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const mainKeyword = sorted[0];
  if (!url.includes(mainKeyword)) return false;
  // If there's a second meaningful keyword (>3 chars), at least one must also match
  const secondary = sorted.slice(1).filter(k => k.length > 3);
  if (secondary.length > 0 && !secondary.some(k => url.includes(k))) return false;
  return true;
}

function isValidImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url) ||
    url.includes('/product') || url.includes('/upload') || url.includes('/image');
}

async function downloadAndProcess(url: string, outputPath: string): Promise<{ ok: boolean; w?: number; h?: number }> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': UA },
      maxContentLength: 20 * 1024 * 1024,
    });
    const buf = Buffer.from(res.data);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || meta.width < 300 || meta.height < 300) return { ok: false };
    let pipeline = sharp(buf);
    if (meta.width > 1600 || meta.height > 1600) {
      pipeline = pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
    const out = await sharp(outputPath).metadata();
    return { ok: true, w: out.width, h: out.height };
  } catch { return { ok: false }; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractKeywords(name: string): string[] {
  return name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  const products = data.products as Array<{ id: number; name: string; categoryId?: string; specification?: string; image: string }>;
  const missing: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const outputPath = path.join(OUTPUT_DIR, `product-${p.id}.webp`);

    if (fs.existsSync(outputPath)) {
      process.stdout.write(`${prefix}  ↷ ${p.name} (already exists, skipping)\n`);
      data.products[i].image = `/images/products/product-${p.id}.webp`;
      continue;
    }

    const keywords = extractKeywords(p.name);
    const catTerm = CATEGORY_TERMS[p.categoryId ?? ''] ?? 'medical aesthetic product';

    const queries = [
      `"${p.name}" product`,
      `${p.name} ${catTerm}`,
      `${p.name} injection aesthetic`,
    ];

    let downloaded = false;

    for (const query of queries) {
      await sleep(1200);
      const images = await searchBingImages(query);

      // First pass: strict URL match (product name in URL) + no watermarks
      for (const url of images.slice(0, 20)) {
        if (isWatermarked(url)) continue;
        if (!strictUrlMatch(url, keywords)) continue;
        if (!isValidImageUrl(url)) continue;
        await sleep(300);
        const result = await downloadAndProcess(url, outputPath);
        if (result.ok) {
          process.stdout.write(`${prefix}  ✓ ${p.name} (strict match, ${result.w}×${result.h})\n`);
          data.products[i].image = `/images/products/product-${p.id}.webp`;
          downloaded = true;
          break;
        }
      }
      if (downloaded) break;
    }

    if (!downloaded) {
      process.stdout.write(`${prefix}  ✗ ${p.name} (no confirmed match — keeping original)\n`);
      missing.push(`#${p.id} ${p.name}`);
      // Keep original image path unchanged
    }

    // Save progress every 10 products
    if (i % 10 === 9) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  if (missing.length) {
    fs.writeFileSync(MISSING_FILE, missing.join('\n'), 'utf8');
    process.stdout.write(`\n${missing.length} products without confirmed images → public/missing-images.txt\n`);
    process.stdout.write('Use the admin panel (/manzura/products) to upload images manually for those.\n');
  }
  process.stdout.write('\nDone. products.json updated.\n');
}

main().catch(console.error);
