import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}

async function ddgTextSearch(query: string): Promise<string[]> {
  try {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const urls: string[] = [];
    $('.result__url').each((_, el) => {
      const href = $(el).text().trim();
      if (href && !href.includes('duckduckgo') && urls.length < 3) {
        urls.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });
    return urls;
  } catch { return []; }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    $('script,style,nav,footer,header,aside').remove();
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
  } catch { return ''; }
}

function extractBenefits(text: string, name: string): string[] {
  const lines = text.split(/[.\n•·–—]/).map(l => l.trim()).filter(l => l.length > 20 && l.length < 200);
  const keywords = ['benefit', 'effect', 'result', 'treat', 'reduce', 'improve', 'restore', 'stimulate', 'correct', 'volume', 'hydrat', 'lift'];
  return lines
    .filter(l => keywords.some(k => l.toLowerCase().includes(k)))
    .slice(0, 5);
}

function extractTreatmentAreas(text: string): string[] {
  const areas = ['face', 'lips', 'nasolabial', 'cheeks', 'forehead', 'neck', 'hands', 'body', 'scalp', 'under-eye', 'jawline', 'temples', 'chin'];
  return areas.filter(a => text.toLowerCase().includes(a));
}

function extractDuration(text: string): string | undefined {
  const m = text.match(/(\d+[\-–]\d+\s*months?|\d+\s*months?|\bup to \d+\s*months?)/i);
  return m?.[0];
}

function extractIngredients(text: string): string | undefined {
  const m = text.match(/(hyaluronic acid|HA|lidocaine|PDRN|salmon DNA|polynucleotide|exosome|peptide|collagen|botulinum|abobotulinumtoxin)[^.]{0,200}/i);
  return m?.[0]?.trim();
}

function extractProtocol(text: string): string | undefined {
  const m = text.match(/(inject|administer|apply|use|dosage|protocol)[^.]{20,200}\./i);
  return m?.[0]?.trim();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Array<{ id: number; name: string; enrichedInfo?: EnrichedInfo }>;
  let enriched = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    if (p.enrichedInfo) {
      console.log(`${prefix}  ↷ ${p.name} (already enriched, skipping)`);
      continue;
    }

    await sleep(2000);
    const urls = await ddgTextSearch(`${p.name} aesthetic cosmetic ingredients benefits`);
    let combined = '';

    for (const url of urls) {
      await sleep(800);
      combined += ' ' + await fetchPageText(url);
    }

    if (!combined.trim()) {
      console.log(`${prefix}  ✗ ${p.name} (no pages found)`);
      continue;
    }

    const info: EnrichedInfo = {};
    const benefits = extractBenefits(combined, p.name);
    if (benefits.length) info.benefits = benefits;
    const areas = extractTreatmentAreas(combined);
    if (areas.length) info.treatmentAreas = areas;
    const duration = extractDuration(combined);
    if (duration) info.duration = duration;
    const ingredients = extractIngredients(combined);
    if (ingredients) info.ingredients = ingredients;
    const protocol = extractProtocol(combined);
    if (protocol) info.protocol = protocol;

    if (Object.keys(info).length > 0) {
      data.products[i].enrichedInfo = info;
      enriched++;
      console.log(`${prefix}  ✓ ${p.name} (fields: ${Object.keys(info).join(', ')})`);
    } else {
      console.log(`${prefix}  ✗ ${p.name} (no structured info found)`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone. ${enriched} products enriched.`);
}

main().catch(console.error);
