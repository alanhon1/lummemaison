const fs = require('fs');

const rawText = fs.readFileSync('pdf-text.txt', 'utf8');

// Split into pages
const pages = rawText.split(/=== PAGE \d+ ===/);
// pages[0] is empty, pages[1] is page 1 (TOC), pages[2] is page 2, etc.

// Merge pages 2-54 (skip page 1 which is TOC)
const productText = pages.slice(2).join(' ')
  .replace(/\n/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();

const categories = [
  { id: 'fillers', name: 'Fillers', range: [1, 70] },
  { id: 'mesotherapy', name: 'Mesotherapy / Biorevitalization / HA', range: [71, 141] },
  { id: 'acne-treatment', name: 'Acne Treatment', range: [142, 149] },
  { id: 'hair-treatment', name: 'Hair Treatment', range: [150, 163] },
  { id: 'pharmacy-favourites', name: 'Pharmacy Favourites', range: [164, 179] },
  { id: 'topical-cosmetics', name: 'Topical Cosmetics', range: [180, 203] },
  { id: 'intimate-care', name: 'Intimate Care', range: [204, 207] },
  { id: 'growth-factor-exosome', name: 'Growth Factor & Exosome Therapy', range: [208, 214] },
  { id: 'curenex', name: 'Curenex Products Line', range: [215, 226] },
  { id: 'dermagen', name: 'Dermagen Products Line', range: [227, 247] },
  { id: 'gtm', name: 'GTM Products Line', range: [248, 267] },
  { id: 'equipment', name: 'Equipment', range: [268, 287] },
  { id: 'salon-grade', name: 'Salon-Grade Products (Large Format)', range: [288, 292] },
  { id: 'lipolytics', name: 'Lipolytics Fat Burning Cocktails', range: [293, 309] },
  { id: 'botulinum', name: 'Botulinum Therapy', range: [310, 337] },
  { id: 'injections', name: 'Injections', range: [338, 386] },
  { id: 'anesthetics', name: 'Anesthetics', range: [387, 400] },
  { id: 'placental-therapy', name: 'Placental Therapy', range: [401, 406] },
  { id: 'nano-needle-cannula', name: 'Nano Needle and Cannula', range: [407, 426] },
  { id: 'imported-products', name: 'Imported Products', range: [427, 438] },
];

function getCat(num) {
  for (const c of categories) if (num >= c.range[0] && num <= c.range[1]) return c.id;
  return 'other';
}

// Find all product number positions in productText
// Pattern: number followed by period and space, where the number is 1-438
// Must not be part of a decimal (e.g., not 1.1)
const positions = [];
const posRe = /(?<!\d)(\d{1,3})\. +/g;
let m;
while ((m = posRe.exec(productText)) !== null) {
  const num = parseInt(m[1]);
  if (num >= 1 && num <= 438) {
    positions.push({ num, idx: m.index, len: m[0].length });
  }
}

console.log('Positions found:', positions.length);

// Extract product blocks
const blocks = {};
for (let i = 0; i < positions.length; i++) {
  const { num, idx } = positions[i];
  const end = i + 1 < positions.length ? positions[i + 1].idx : productText.length;
  const block = productText.substring(idx, end).replace(/\s+/g, ' ').trim();

  // Validate: block should not be from table headers
  if (block.includes('PRODUCT NAME') || block.includes('SPECIFICATION') && block.length < 50) continue;

  if (!blocks[num]) {
    blocks[num] = block;
  } else if (block.length > blocks[num].length) {
    blocks[num] = block;
  }
}

console.log('Unique product blocks:', Object.keys(blocks).length);

function cleanPrice(str) {
  // Handle spaced prices like "$ 4 5 .00" -> 45.00
  const allPrices = [];
  const re = /\$\s*([\d\s,.]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const digits = m[1].replace(/\s/g, '').replace(/,/g, '');
    // Handle "4500" which should be "45.00" (no decimal) vs actual prices
    const p = parseFloat(digits);
    if (!isNaN(p) && p > 0 && p < 50000) allPrices.push(p);
  }
  // Return the last price found (most likely the actual price)
  return allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;
}

function extractName(block, num) {
  let rest = block.replace(/^\d+\.\s*/, '').trim();
  // Remove tags
  rest = rest.replace(/^(?:ON SALE!\s*|NEW\s*!\s*|SALE\s*PRICE\s*FOR\s*ONE\s*MONTH\s*)/gi, '').trim();

  // Split into tokens
  const tokens = rest.split(/\s+/);
  const nameParts = [];

  for (let i = 0; i < tokens.length && i < 25; i++) {
    const t = tokens[i];
    // Stop conditions
    if (t.startsWith('$')) break;
    // Skip measurement patterns that indicate start of spec
    if (i > 0 && t.match(/^\d+(?:\.\d+)?$/) && tokens[i+1] && tokens[i+1].match(/^(?:mL|ml|mg|g|cc)$/i)) break;
    // Accept as part of name: uppercase tokens, common abbreviations
    const isUpperCase = t === t.toUpperCase() && t.match(/[A-Z]/);
    const isParenthetical = t.match(/^\(?(?:CE|No|NO|Lidocaine|MESO|with|WITHOUT|AND|OR|FOR|Plus|Premium)\)?$/i);
    const isSymbol = t.match(/^[#\-+×x\/.,()%&]$/);

    if (isUpperCase || isParenthetical || isSymbol) {
      nameParts.push(t);
    } else if (nameParts.length === 0) {
      nameParts.push(t);
    } else if (t.match(/^[A-Z][a-z]/) && nameParts.length < 5) {
      nameParts.push(t);
    } else {
      break;
    }
  }

  return nameParts.join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*[#\-+×x\/.,()%&]\s*$/, '')
    .trim()
    .substring(0, 80) || `Product ${num}`;
}

function extractDesc(block, name) {
  let text = block.replace(/^\d+\.\s*/, '');
  // Try to find descriptive sentences
  const longWords = text.match(/[A-Z][a-z][^$]{20,}/g);
  if (longWords) return longWords[0].trim().substring(0, 400);
  return '';
}

function extractSpec(block) {
  const specPat = /(\d+[\d.\s]*(?:mL|ml|mg|g|cc|unit|units|vial|vials|syr|syringe|tab|tabs|tablet|tablets|amp|ampule|ampules|ampoule|ampoules|pcs|pc|ea)\s*(?:x|×|\/|\*)\s*\d+[^$]{0,80})/i;
  const m = block.match(specPat);
  if (m) return m[1].trim().substring(0, 150);
  // Simpler: find first measurement
  const m2 = block.match(/(\d+[\d.\s]*(?:mL|ml|mg|g|cc|unit|units|vial|vials|syr|syringe|tab|tabs|amp|pcs)[^$]{0,60})/i);
  if (m2) return m2[1].trim().substring(0, 150);
  return '';
}

const products = [];
const bestSellers = new Set([1, 2, 17, 21, 71, 75, 79, 80, 86, 95, 96, 110, 125, 139, 150, 153, 310, 317, 353, 401, 403, 427, 435, 437, 438]);

for (let num = 1; num <= 438; num++) {
  const block = blocks[num] || '';
  const cat = getCat(num);

  const tags = [];
  if (/ON SALE!/i.test(block) || /SALE PRICE/i.test(block)) tags.push('sale');
  if (/NEW\s*!/i.test(block)) tags.push('new');

  const price = cleanPrice(block);
  const name = block ? extractName(block, num) : `Product ${num}`;
  const specification = block ? extractSpec(block) : '';
  const description = block ? extractDesc(block, name) : '';

  products.push({
    id: num,
    name,
    categoryId: cat,
    specification,
    description,
    price,
    tags,
    isNew: tags.includes('new'),
    isSale: tags.includes('sale'),
    isBestSeller: bestSellers.has(num),
    inStock: true,
    image: '',
    moq: 1,
  });
}

const out = { categories, products };
fs.writeFileSync('data/products.json', JSON.stringify(out, null, 2), 'utf8');

console.log(`\nOutput: ${products.length} products`);
console.log(`With price: ${products.filter(p => p.price > 0).length}`);
console.log(`With spec: ${products.filter(p => p.specification).length}`);
console.log(`Sale: ${products.filter(p => p.isSale).length}`);
console.log(`New: ${products.filter(p => p.isNew).length}`);
console.log('\nSamples:');
[1, 2, 10, 71, 142, 310, 401, 427].forEach(id => {
  const p = products.find(x => x.id === id);
  if (p) console.log(`  #${id}: "${p.name}" $${p.price} [${p.categoryId}]`);
});
