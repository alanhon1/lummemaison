// Fix product name/spec parsing artifacts from PDF extraction
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));

let namesFix = 0, specsFix = 0;

data.products.forEach(p => {
  const origName = p.name;
  const origSpec = p.specification;

  // Fix: unclosed parentheses at end of name like "(CE" → "(CE)"
  p.name = p.name
    .replace(/\(\s*([A-Z. ]+)\s*$/, (_, inner) => `(${inner.trim()})`)
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .trim();

  // Fix: "ON SALE!" prefix in name (keep it) but clean spacing
  // Fix extra internal spaces
  p.name = p.name.replace(/\s{2,}/g, ' ').trim();

  if (p.name !== origName) { console.log(`Name #${p.id}: "${origName}" → "${p.name}"`); namesFix++; }

  // Fix specification artifacts
  p.specification = p.specification
    .replace(/1sy\s+r\b/gi, '1syr')
    .replace(/\bsyr\s+,/g, 'syr,')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();

  if (p.specification !== origSpec) specsFix++;
});

fs.writeFileSync('data/products.json', JSON.stringify(data, null, 2), 'utf8');
console.log(`\nFixed: ${namesFix} names, ${specsFix} specs`);
