const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = fs.readFileSync('./APR2026-CATALOGUE.pdf');
  const uint8 = new Uint8Array(data);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
  console.log('Pages:', doc.numPages);
  for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (text.trim()) {
      console.log(`\n--- Page ${i} ---`);
      console.log(text);
    }
  }
}

main().catch(console.error);
