const fs = require('fs');

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = fs.readFileSync('./APR2026-CATALOGUE.pdf');
  const uint8 = new Uint8Array(data);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
  console.log('Pages:', doc.numPages);
  let allText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (text.trim()) {
      allText += `\n--- Page ${i} ---\n${text}\n`;
    }
  }
  fs.writeFileSync('./pdf-content.txt', allText, 'utf8');
  console.log('Done. Saved to pdf-content.txt');
}

main().catch(console.error);
