/**
 * Parses the mg.gofillerss.com Shopify sitemap and returns product entries
 * with slug, name, and image URL. Used by refill-from-secondary.ts as the
 * secondary scraping source.
 */

import axios from 'axios';

const SITEMAP_INDEX = 'https://mg.gofillerss.com/sitemap.xml';
const TIMEOUT_MS = 30_000;

export interface GofillerssProduct {
  slug: string;
  name: string;
  imageUrl: string;
}

interface SitemapRef { loc: string }

async function fetchText(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  return res.data;
}

async function fetchSitemapIndex(): Promise<SitemapRef[]> {
  const xml = await fetchText(SITEMAP_INDEX);
  const refs: SitemapRef[] = [];
  const blocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) ?? [];
  for (const block of blocks) {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    if (m) refs.push({ loc: m[1] });
  }
  return refs;
}

async function fetchProductSitemap(url: string): Promise<GofillerssProduct[]> {
  const xml = await fetchText(url);
  const products: GofillerssProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(https:\/\/mg\.gofillerss\.com\/products\/([^<]+))<\/loc>/);
    if (!locMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');

    // Shopify product entries embed image:image with image:loc and image:title
    const imgLocMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/);
    const imgTitleMatch = block.match(/<image:title>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/image:title>/);
    if (!imgLocMatch) continue;

    const name = (imgTitleMatch?.[1] ?? slug.replace(/-/g, ' ')).trim();
    products.push({ slug, name, imageUrl: imgLocMatch[1] });
  }

  return products;
}

export async function fetchAllGofillerssProducts(): Promise<GofillerssProduct[]> {
  const refs = await fetchSitemapIndex();
  const productSitemaps = refs.filter(r => /sitemap_products_/i.test(r.loc));
  if (productSitemaps.length === 0) {
    throw new Error('No sitemap_products_* found in gofillerss sitemap index');
  }
  const all: GofillerssProduct[] = [];
  for (const ref of productSitemaps) {
    const batch = await fetchProductSitemap(ref.loc);
    all.push(...batch);
  }
  return all;
}

// CLI smoke test: run with `npm run sync-gofillerss` to dump the parsed list.
if (require.main === module) {
  fetchAllGofillerssProducts()
    .then(products => {
      console.log(`Parsed ${products.length} products from gofillerss.`);
      console.log('First 3:', JSON.stringify(products.slice(0, 3), null, 2));
    })
    .catch(err => {
      console.error('Failed:', err.message);
      process.exit(1);
    });
}
