/**
 * Parses jdbioshop.com (Shopify) product sitemap and returns
 * { slug, name, imageUrl } entries. Used by acquire-missing-images.ts
 * as a third secondary source alongside aesthetics-shop and gofillerss.
 */

import axios from 'axios';

const SITEMAP_INDEX = 'https://jdbioshop.com/sitemap.xml';
const TIMEOUT_MS = 30_000;

export interface JdbioshopProduct {
  slug: string;
  name: string;
  imageUrl: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  return res.data;
}

export async function fetchAllJdbioshopProducts(): Promise<JdbioshopProduct[]> {
  const indexXml = await fetchText(SITEMAP_INDEX);
  const productSitemapUrls = (indexXml.match(/<loc>([^<]+)<\/loc>/g) ?? [])
    .map(m => m.replace(/<\/?loc>/g, ''))
    .filter(u => u.includes('sitemap_products_') && !u.includes('/es/') && !u.includes('/ru/'));

  const all: JdbioshopProduct[] = [];
  for (const url of productSitemapUrls) {
    const decoded = url.replace(/&amp;/g, '&');
    const xml = await fetchText(decoded);
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>(https:\/\/jdbioshop\.com\/products\/([^<]+))<\/loc>/);
      if (!locMatch) continue;
      const slug = locMatch[2].replace(/\/$/, '');

      const imgLocMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/);
      const imgTitleMatch = block.match(/<image:title>([^<]+)<\/image:title>/);
      const imgCaptionMatch = block.match(/<image:caption>([^<]+)<\/image:caption>/);

      if (!imgLocMatch) continue;
      const imageUrl = imgLocMatch[1].trim();
      const name = (imgCaptionMatch?.[1] || imgTitleMatch?.[1] || slug.replace(/-/g, ' ')).trim();

      all.push({ slug, name, imageUrl });
    }
  }
  return all;
}

if (require.main === module) {
  fetchAllJdbioshopProducts()
    .then(ps => {
      console.log(`Fetched ${ps.length} products from jdbioshop`);
      console.log(JSON.stringify(ps.slice(0, 3), null, 2));
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
