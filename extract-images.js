// Extract JPEG image XObjects from PDF and resize to web-optimized 400x400

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PDF_PATH = path.join(__dirname, 'APR2026- CATALOGUE.pdf');
const OUTPUT_DIR = path.join(__dirname, 'public', 'images', 'products');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const buf = fs.readFileSync(PDF_PATH);
console.log('PDF size:', (buf.length / 1024 / 1024).toFixed(1), 'MB');

// Find JPEG streams that start right after "stream\n" or "stream\r\n"
const streamMarker = Buffer.from('stream');
const allJpegs = [];

let searchPos = 0;
while (searchPos < buf.length - 10) {
  const sPos = buf.indexOf(streamMarker, searchPos);
  if (sPos === -1) break;

  let dataStart = -1;
  if (buf[sPos + 6] === 0x0D && buf[sPos + 7] === 0x0A) dataStart = sPos + 8;
  else if (buf[sPos + 6] === 0x0A) dataStart = sPos + 7;

  if (dataStart !== -1 && buf[dataStart] === 0xFF && buf[dataStart + 1] === 0xD8 && buf[dataStart + 2] === 0xFF) {
    let endPos = dataStart + 2;
    let found = false;
    while (endPos < buf.length - 1) {
      if (buf[endPos] === 0xFF && buf[endPos + 1] === 0xD9) { endPos += 2; found = true; break; }
      endPos++;
    }
    if (found) {
      allJpegs.push(buf.slice(dataStart, endPos));
      searchPos = endPos;
      continue;
    }
  }
  searchPos = sPos + 7;
}

console.log(`Total JPEG streams found: ${allJpegs.length}`);

async function process() {
  const analyzed = [];
  for (const jpeg of allJpegs) {
    try {
      const meta = await sharp(jpeg).metadata();
      // Product photos: 100-500px wide, 60-350px tall, >=2KB
      if (meta.width >= 100 && meta.width <= 500 && meta.height >= 60 && meta.height <= 350 && jpeg.length >= 2000) {
        analyzed.push({ jpeg, w: meta.width, h: meta.height });
      }
    } catch(e) {}
  }

  console.log(`Product photos found: ${analyzed.length}`);

  // Clear output dir
  fs.readdirSync(OUTPUT_DIR).forEach(f => fs.unlinkSync(path.join(OUTPUT_DIR, f)));

  // Resize to 400x400 (contain + white background) for consistent web display
  let saved = 0;
  for (let i = 0; i < analyzed.length; i++) {
    const fname = path.join(OUTPUT_DIR, `${String(i + 1).padStart(3, '0')}.jpg`);
    try {
      await sharp(analyzed[i].jpeg)
        .resize(400, 400, {
          fit: 'contain',
          background: { r: 250, g: 248, b: 244, alpha: 1 }, // cream background
        })
        .jpeg({ quality: 82 })
        .toFile(fname);
      saved++;
      if ((i + 1) % 50 === 0) process.stdout.write(`\rProcessed ${i + 1}/${analyzed.length}...`);
    } catch(e) {
      console.warn(`Failed to process image ${i + 1}:`, e.message);
    }
  }

  console.log(`\nSaved ${saved} resized images`);

  // Update products.json - sequential mapping
  const data = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
  let updated = 0;
  data.products.forEach((p, i) => {
    if (i < saved) {
      p.image = `/images/products/${String(i + 1).padStart(3, '0')}.jpg`;
      updated++;
    } else {
      p.image = '';
    }
  });
  fs.writeFileSync('data/products.json', JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated products.json: ${updated}/${data.products.length} products have images`);
}

process().catch(console.error);
