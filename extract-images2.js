const fs = require('fs');
const path = require('path');

const PDF_PATH = path.join(__dirname, 'APR2026- CATALOGUE.pdf');
const OUTPUT_DIR = path.join(__dirname, 'public', 'images', 'products');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;

  console.log('Pages:', pdf.numPages);

  // Map each page → list of unique image names
  const pageImages = {};
  for (let p = 2; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const ops = await page.getOperatorList();
    const seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
        const name = ops.argsArray[i][0];
        seen.add(name);
      }
    }
    pageImages[p] = [...seen];
    process.stdout.write(`\rPage ${p}/${pdf.numPages} — ${seen.size} images`);
  }

  console.log('\n\nImages per page:');
  let total = 0;
  for (const [p, imgs] of Object.entries(pageImages)) {
    console.log(`  Page ${p}: ${imgs.length} images (${imgs.join(', ')})`);
    total += imgs.length;
  }
  console.log('Total unique image XObjects across all pages:', total);
}

main().catch(console.error);
