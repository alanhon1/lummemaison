const fs = require('fs');

const text = fs.readFileSync('pdf-text.txt', 'utf8');

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

function getCategoryForProduct(num) {
  for (const cat of categories) {
    if (num >= cat.range[0] && num <= cat.range[1]) return cat;
  }
  return null;
}

function parsePrice(str) {
  const cleaned = str.replace(/\s/g, '');
  const match = cleaned.match(/\$([\d,.]+)/);
  if (match) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) return price;
  }
  return null;
}

// Merge all text and normalize whitespace
const allText = text
  .replace(/=== PAGE \d+ ===\n/g, ' ')
  .replace(/\n/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Split by product number pattern: "NNN.  " where NNN is 1-438
// Use lookahead to split on next product number
const productRegex = /(?=\b(\d{1,3})\.\s+(?!(?:0|00|000)\b))/g;

// Find all product number positions
const positions = [];
let match;
const re = /\b(\d{1,3})\.\s+/g;
while ((match = re.exec(allText)) !== null) {
  const num = parseInt(match[1]);
  if (num >= 1 && num <= 438) {
    positions.push({ num, idx: match.index });
  }
}

// Extract blocks between positions
const blocks = {};
for (let i = 0; i < positions.length; i++) {
  const { num, idx } = positions[i];
  const end = i + 1 < positions.length ? positions[i + 1].idx : allText.length;
  // Only store if block is reasonable
  if (end - idx > 5) {
    const block = allText.substring(idx, end).trim();
    // Verify it starts with the number
    if (block.startsWith(num + '.') || block.match(new RegExp(`^${num}\\.`))) {
      if (!blocks[num] || block.length > blocks[num].length) {
        blocks[num] = block;
      }
    }
  }
}

console.log('Blocks found:', Object.keys(blocks).length);

// Now parse each block more carefully
const products = [];

// Helper: extract name from block text
function extractProductName(block, num) {
  // Remove leading number
  let rest = block.replace(/^\d+\.\s*/, '').trim();

  // Remove leading tags
  rest = rest.replace(/^(?:ON SALE!|NEW\s*!|SALE)\s*/gi, '').trim();

  // Collect name tokens - uppercase sequences
  const tokens = rest.split(/\s+/);
  const nameParts = [];

  for (let i = 0; i < tokens.length && i < 20; i++) {
    const t = tokens[i];
    // Stop at obvious non-name indicators
    if (t.match(/^\$/)) break;
    if (t.match(/^\d+(?:\.\d+)?(?:mL|mg|g|unit|vial|syr|tab|amp|pcs|ea)$/i)) break;
    if (t.match(/^[a-z]/) && nameParts.length > 0) {
      // Could be continuation like "ml" or "x"
      if (!t.match(/^(?:x|ml|mg|g|ea|pcs)$/i)) break;
    }
    // Accept uppercase, numbers, special chars that are part of product names
    if (t.match(/^[A-Z0-9\-+().,#\/'""&%\[\]]+$/) || t.match(/^\((?:CE|No|NO)\)$/i)) {
      nameParts.push(t);
    } else if (nameParts.length === 0) {
      // First token, accept it
      nameParts.push(t);
    } else if (t.match(/^[A-Z][a-z]/)) {
      // Mixed case, might be part of name if short
      if (t.length <= 4) nameParts.push(t);
      else break;
    } else {
      break;
    }
  }

  return nameParts.join(' ').trim().substring(0, 100);
}

function extractSpec(block) {
  // Look for measurement patterns
  const specPatterns = [
    /\d+\s*(?:mL|ml|mg|g|units?|vials?|syr(?:inge)?|tabs?|ampules?|pcs?|ea|cc)\s*[x×]\s*\d+[^$\n]*/gi,
    /\d+\s*(?:mL|ml|mg|g|units?|vials?|syr(?:inge)?|tabs?|ampules?|pcs?|ea|cc)[^$\n]*/gi,
  ];
  for (const pat of specPatterns) {
    const m = block.match(pat);
    if (m) return m[0].trim().substring(0, 150);
  }
  return '';
}

function extractDescription(block, name) {
  // Remove number, name, and price to get description
  let text = block
    .replace(/^\d+\.\s*/, '')
    .replace(name, '')
    .replace(/\$\s*[\d\s,.]+/g, '')
    .replace(/(?:ON SALE!|NEW\s*!|SALE)\s*/gi, '')
    .trim();

  // Take meaningful sentences
  const sentences = text.match(/[A-Z][^.!?]*[.!?]/g) || [];
  const desc = sentences.slice(0, 3).join(' ').trim();
  return desc.substring(0, 400);
}

for (let num = 1; num <= 438; num++) {
  const block = blocks[num];
  const cat = getCategoryForProduct(num);

  let name = `Product ${num}`;
  let specification = '';
  let description = '';
  let price = 0;
  let tags = [];

  if (block) {
    // Tags
    if (/ON SALE!/i.test(block) || /SALE PRICE/i.test(block)) tags.push('sale');
    if (/NEW\s*!/i.test(block)) tags.push('new');

    // Price - find all price patterns and take the last reasonable one
    const priceMatches = [...block.matchAll(/\$\s*([\d\s,.]+)/g)];
    for (const m of priceMatches) {
      const p = parseFloat(m[1].replace(/\s/g, '').replace(/,/g, ''));
      if (!isNaN(p) && p > 0 && p < 50000) price = p;
    }

    name = extractProductName(block, num);
    specification = extractSpec(block);
    description = extractDescription(block, name);
  }

  products.push({
    id: num,
    name: name || `Product ${num}`,
    categoryId: cat ? cat.id : 'other',
    specification: specification,
    description: description,
    price: price,
    tags: tags,
    isNew: tags.includes('new'),
    isSale: tags.includes('sale'),
    isBestSeller: false,
    inStock: true,
    image: '',
    moq: 1,
  });
}

// Mark best sellers
const bestSellers = [1, 2, 17, 21, 71, 79, 80, 86, 95, 96, 125, 150, 153, 310, 317, 401, 403, 435, 437, 438];
for (const p of products) {
  if (bestSellers.includes(p.id)) p.isBestSeller = true;
}

const output = {
  categories,
  products,
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/products.json', JSON.stringify(output, null, 2), 'utf8');

const withPrice = products.filter(p => p.price > 0).length;
const withName = products.filter(p => !p.name.startsWith('Product ')).length;
console.log(`Generated ${products.length} products in ${categories.length} categories`);
console.log(`Products with price: ${withPrice}`);
console.log(`Products with parsed name: ${withName}`);
console.log(`Sale: ${products.filter(p => p.isSale).length}, New: ${products.filter(p => p.isNew).length}`);

// Sample output
console.log('\nSample products:');
[1, 10, 71, 142, 310, 401].forEach(id => {
  const p = products.find(x => x.id === id);
  if (p) console.log(`  #${id}: ${p.name} | $${p.price} | ${p.categoryId}`);
});
