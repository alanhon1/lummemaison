/**
 * Scrapes gallery images from aesthetics-shop.com product pages and saves
 * them locally. Writes the `images` array to data/products.json.
 *
 * For each group, fetches up to 3 extra images (beyond the main image).
 * All products in the group receive the same images[] array.
 *
 * Usage:
 *   npx tsx scripts/scrape-gallery-images.ts          # skip groups with existing images
 *   npx tsx scripts/scrape-gallery-images.ts --force  # overwrite all
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const FORCE = process.argv.includes('--force');
const DELAY_MS = 1500;
const MAX_EXTRA_IMAGES = 3;

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  images?: string[];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeGalleryUrls(slug: string): Promise<string[]> {
  const url = `https://aesthetics-shop.com/product/${slug}/`;
  const res = await axios.get<string>(url, {
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  const $ = cheerio.load(res.data);

  const urls: string[] = [];

  // WooCommerce gallery: anchor hrefs are the full-size image URLs
  $('.woocommerce-product-gallery__image a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http') && !urls.includes(href)) {
      urls.push(href);
    }
  });

  // Fallback: data-large_image on gallery items
  if (urls.length === 0) {
    $('.woocommerce-product-gallery__image').each((_, el) => {
      const src = $(el).find('img').attr('data-large_image');
      if (src && src.startsWith('http') && !urls.includes(src)) {
        urls.push(src);
      }
    });
  }

  // Fallback: og:image meta tags
  if (urls.length === 0) {
    $('meta[property="og:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content && content.startsWith('http') && !urls.includes(content)) {
        urls.push(content);
      }
    });
  }

  return urls;
}

async function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const buf = Buffer.from(res.data);
  await sharp(buf)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(destPath);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  // Find the primary product (lowest id) for each group
  const groupPrimaries = new Map<string, Product>();
  for (const p of allProducts) {
    if (!p.groupId) continue;
    const existing = groupPrimaries.get(p.groupId);
    if (!existing || p.id < existing.id) {
      groupPrimaries.set(p.groupId, p);
    }
  }

  const slugs = Array.from(groupPrimaries.keys());
  console.log(`Processing ${slugs.length} groups…`);

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const primary = groupPrimaries.get(slug)!;
    const prefix = `[${i + 1}/${slugs.length}] ${slug}`;

    // Skip if already has extra images and not forcing
    if (!FORCE && primary.images && primary.images.length > 0) {
      process.stdout.write(`${prefix} — skipped (has images)\n`);
      continue;
    }

    let galleryUrls: string[];
    try {
      galleryUrls = await scrapeGalleryUrls(slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${prefix} ✗ fetch error: ${msg}\n`);
      continue;
    }

    // Gallery[0] is typically the main product image already downloaded.
    // Download extra images starting from index 1.
    const extraUrls = galleryUrls.slice(1, 1 + MAX_EXTRA_IMAGES);

    if (extraUrls.length === 0) {
      process.stdout.write(`${prefix} — no extra images found\n`);
      continue;
    }

    const savedPaths: string[] = [];
    for (let j = 0; j < extraUrls.length; j++) {
      const destPath = path.join(OUTPUT_DIR, `product-${primary.id}-${j + 2}.webp`);
      try {
        await downloadImage(extraUrls[j], destPath);
        savedPaths.push(`/images/products/product-${primary.id}-${j + 2}.webp`);
      } catch {
        // Skip failed individual images silently
      }
    }

    if (savedPaths.length === 0) {
      process.stdout.write(`${prefix} — all downloads failed\n`);
      continue;
    }

    // Write images[] to ALL products in this group
    for (let k = 0; k < allProducts.length; k++) {
      if (allProducts[k].groupId === slug) {
        allProducts[k].images = savedPaths;
      }
    }

    process.stdout.write(`${prefix} ✓ ${savedPaths.length} extra image(s)\n`);

    // Save progress every 10 groups
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }

    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('\nDone.');
}

main();
