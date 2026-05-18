import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const JSON_PATH = path.join(ROOT, 'data', 'products.json');

function wipeFiles(): number {
  if (!fs.existsSync(IMG_DIR)) {
    console.log(`(skip) ${IMG_DIR} does not exist`);
    return 0;
  }
  const files = fs.readdirSync(IMG_DIR);
  let n = 0;
  for (const f of files) {
    const p = path.join(IMG_DIR, f);
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      fs.unlinkSync(p);
      n++;
    }
  }
  return n;
}

function wipeJson(): { products: number; cleared: number } {
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  let cleared = 0;
  for (const p of data.products) {
    if (p.image && p.image !== '') { p.image = ''; cleared++; }
    if ('images' in p) { delete p.images; cleared++; }
    if ('groupImage' in p && p.groupImage !== '') { p.groupImage = ''; cleared++; }
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return { products: data.products.length, cleared };
}

const filesDeleted = wipeFiles();
const jsonResult = wipeJson();
console.log(`Deleted ${filesDeleted} file(s) from public/images/products/`);
console.log(`Cleared ${jsonResult.cleared} field(s) across ${jsonResult.products} product(s) in data/products.json`);
