import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const PDF_TEXT_FILE = path.join(process.cwd(), 'lumeemasonpic', 'pdf-content.txt');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'description-report.txt');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIN_DESC_LENGTH = 60;

interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
}

// Parses pdf-content.txt → Map<productId, rawEntryText>
// Each entry is the text between "N.  " and the start of the next entry.
function parsePdfEntries(pdfText: string): Map<number, string> {
  const map = new Map<number, string>();

  // Flatten: remove page markers, collapse whitespace to single spaces
  const flat = pdfText
    .replace(/---\s*Page\s*\d+\s*---/g, ' ')
    .replace(/\(\s*\d+\s*\)\s+[A-Z\/\s&]+(?:№\s+PRODUCT NAME\s+SPECIFICATION\s+PRODUCT IMAGE\s+PRICE)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (let id = 1; id <= 438; id++) {
    // Find "id.  " (word boundary to avoid matching e.g. "31." inside "131.")
    const startRe = new RegExp(`(?<![\\d])${id}\\.\\s+`);
    const startMatch = startRe.exec(flat);
    if (!startMatch) continue;

    const contentStart = startMatch.index + startMatch[0].length;
    const remaining = flat.slice(contentStart);

    // Entry ends at the next sequential product number or category header
    const nextId = id + 1;
    const endRe = new RegExp(`(?<![\\d])${nextId}\\.\\s+`);
    const endMatch = endRe.exec(remaining);

    const entry = endMatch
      ? remaining.slice(0, endMatch.index)
      : remaining.slice(0, 2000);

    map.set(id, entry.replace(/\s+/g, ' ').trim());
  }

  return map;
}

// Extracts the meaningful description portion from a raw PDF entry.
// Strips price tokens and returns whatever benefit/ingredient text remains.
function extractDescription(raw: string): string {
  let text = raw;

  // Remove price pattern (e.g., "$ 45 .00", "$160.00", "$3800")
  text = text.replace(/\$\s*[\d,\s]+\.?\s*\d{0,2}/g, '');

  // Remove "NEW!", "ON SALE!" labels
  text = text.replace(/\b(NEW|ON SALE|SALE)\s*!?\s*/gi, '');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// DuckDuckGo search + page scrape, returns first relevant sentence (>60 chars).
async function webSearchDescription(productName: string): Promise<string> {
  const query = `"${productName}" skin aesthetic filler treatment description`;
  try {
    await sleep(2000);
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    const urls: string[] = [];
    $('.result__url').each((_, el) => {
      const href = $(el).text().trim();
      if (href && !href.includes('duckduckgo') && urls.length < 3) {
        urls.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });

    for (const url of urls.slice(0, 2)) {
      await sleep(900);
      try {
        const pageRes = await axios.get(url, {
          headers: { 'User-Agent': UA },
          timeout: 12000,
        });
        const $page = cheerio.load(pageRes.data);
        $page('script,style,nav,footer,header,aside').remove();
        const bodyText = $page('body').text().replace(/\s+/g, ' ').trim();

        // Split into sentence-like chunks, pick first one relevant to the product
        const chunks = bodyText
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > MIN_DESC_LENGTH && s.length < 500);

        const nameWords = productName
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3);

        const relevant = chunks.find(chunk => {
          const lower = chunk.toLowerCase();
          const hasProductWord = nameWords.some(w => lower.includes(w));
          const hasContext =
            lower.includes('skin') ||
            lower.includes('injection') ||
            lower.includes('hyaluronic') ||
            lower.includes('filler') ||
            lower.includes('treatment') ||
            lower.includes('collagen') ||
            lower.includes('benefit') ||
            lower.includes('ingredient');
          return hasProductWord && hasContext;
        });

        if (relevant) return relevant;
      } catch {
        continue;
      }
    }
  } catch { }
  return '';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Product[];
  const pdfText = fs.readFileSync(PDF_TEXT_FILE, 'utf8');

  process.stdout.write('Parsing PDF entries...\n');
  const pdfEntries = parsePdfEntries(pdfText);
  process.stdout.write(`Parsed ${pdfEntries.size} PDF entries.\n\n`);

  const pdfSourced: string[] = [];
  const webSourced: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const rawEntry = pdfEntries.get(p.id) ?? '';

    const pdfDesc = extractDescription(rawEntry);

    if (pdfDesc.length >= MIN_DESC_LENGTH) {
      data.products[i].description = pdfDesc;
      pdfSourced.push(`#${p.id} ${p.name}`);
      process.stdout.write(`${prefix} ✓ PDF  ${p.name}\n`);
    } else {
      process.stdout.write(`${prefix} → web  ${p.name}...\n`);
      const webDesc = await webSearchDescription(p.name);

      if (webDesc.length >= MIN_DESC_LENGTH) {
        data.products[i].description = webDesc;
        webSourced.push(`#${p.id} ${p.name}`);
        process.stdout.write(`${prefix} ✓ web  ${p.name}\n`);
      } else {
        // Keep existing description unchanged
        const existing = p.description ?? '';
        failed.push(`#${p.id} ${p.name} (kept: "${existing.slice(0, 60)}${existing.length > 60 ? '…' : ''}")`);
        process.stdout.write(`${prefix} ✗      ${p.name} (kept existing)\n`);
      }
    }

    // Checkpoint save every 20 products
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== PDF SOURCED (${pdfSourced.length}) ===`,
    ...pdfSourced,
    '',
    `=== WEB SOURCED (${webSourced.length}) ===`,
    ...webSourced,
    '',
    `=== FAILED / UNCHANGED (${failed.length}) ===`,
    ...failed,
  ].join('\n');

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  process.stdout.write(
    `\nDone. PDF: ${pdfSourced.length}, Web: ${webSourced.length}, Failed/unchanged: ${failed.length}\n`
  );
  process.stdout.write(`Full report: scripts/description-report.txt\n`);
}

main().catch(console.error);
