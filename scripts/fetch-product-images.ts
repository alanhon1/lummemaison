import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const MISSING_FILE = path.join(process.cwd(), 'public', 'missing-images.txt');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface DdgImage { image: string; title: string; url: string; width: number; height: number; }

async function getVqd(query: string): Promise<string | null> {
  try {
    const res = await axios.get('https://duckduckgo.com/', {
      params: { q: query, iax: 'images', ia: 'images' },
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });
    const m = res.data.match(/vqd=['"]([^'"]+)['"]/i);
    return m?.[1] ?? null;
  } catch { return null; }
}

async function searchImages(query: string): Promise<DdgImage[]> {
  const vqd = await getVqd(query);
  if (!vqd) return [];
  await sleep(1000);
  try {
    const res = await axios.get('https://duckduckgo.com/i.js', {
      params: { q: query, o: 'json', l: 'us-en', s: '0', f: ',,,', vqd },
      headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
      timeout: 10000,
    });
    return res.data?.results ?? [];
  } catch { return []; }
}

function scoreImage(img: DdgImage, nameKeywords: string[]): number {
  const urlLower = img.image.toLowerCase();
  const titleLower = (img.title ?? '').toLowerCase();
  let score = 0;
  const matchedInUrl = nameKeywords.filter(k => urlLower.includes(k)).length;
  const matchedInTitle = nameKeywords.filter(k => titleLower.includes(k)).length;
  score += (matchedInUrl / nameKeywords.length) * 0.4;
  score += (matchedInTitle / nameKeywords.length) * 0.3;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(urlLower)) score += 0.1;
  if (/product|item|pack|bottle|vial|syringe/i.test(urlLower)) score += 0.2;
  if (/banner|advert|person|model|face|logo|icon/i.test(urlLower)) score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

async function downloadAndProcess(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': UA },
    });
    const buf = Buffer.from(res.data);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || meta.width < 400 || meta.height < 400) return false;
    let pipeline = sharp(buf);
    if (meta.width > 1600 || meta.height > 1600) {
      pipeline = pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
    return true;
  } catch { return false; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractKeywords(name: string): string[] {
  return name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Array<{ id: number; name: string; specification?: string; image: string }>;
  const missing: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const outputPath = path.join(OUTPUT_DIR, `product-${p.id}.webp`);

    if (fs.existsSync(outputPath)) {
      console.log(`${prefix}  ↷ ${p.name} (already exists, skipping)`);
      if (!p.image) data.products[i].image = `/images/products/product-${p.id}.webp`;
      continue;
    }

    const keywords = extractKeywords(p.name);
    const specWords = p.specification ? extractKeywords(p.specification).slice(0, 2) : [];
    const queries = [
      `${p.name} ${specWords.join(' ')} product`.trim(),
      `${p.name} Korean cosmetic aesthetic`,
      `${p.name} filler injection dermal`,
    ];

    let downloaded = false;
    for (const query of queries) {
      await sleep(2000);
      const images = await searchImages(query);
      for (const img of images.slice(0, 10)) {
        const score = scoreImage(img, keywords);
        if (score < 0.7) continue;
        await sleep(500);
        const ok = await downloadAndProcess(img.image, outputPath);
        if (ok) {
          const meta = await sharp(outputPath).metadata();
          console.log(`${prefix}  ✓ ${p.name} (score: ${score.toFixed(2)}, ${meta.width}×${meta.height})`);
          data.products[i].image = `/images/products/product-${p.id}.webp`;
          downloaded = true;
          break;
        }
      }
      if (downloaded) break;
    }

    if (!downloaded) {
      console.log(`${prefix}  ✗ ${p.name} (no match ≥ 0.7)`);
      missing.push(`#${p.id} ${p.name}`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  if (missing.length) {
    fs.writeFileSync(MISSING_FILE, missing.join('\n'), 'utf8');
    console.log(`\n${missing.length} products without images → public/missing-images.txt`);
  }
  console.log('\nDone. products.json updated.');
}

main().catch(console.error);
