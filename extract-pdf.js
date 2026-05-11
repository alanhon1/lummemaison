const fs = require('fs');
const path = require('path');

async function extractPDF() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const filePath = path.join(__dirname, 'APR2026- CATALOGUE.pdf');
  const dataBuffer = new Uint8Array(fs.readFileSync(filePath));

  try {
    const loadingTask = pdfjs.getDocument({ data: dataBuffer });
    const pdfDoc = await loadingTask.promise;
    console.log('Pages:', pdfDoc.numPages);

    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n\n=== PAGE ${i} ===\n${pageText}`;
      if (i <= 3) console.log(`Page ${i} preview:`, pageText.substring(0, 200));
    }

    fs.writeFileSync('pdf-text.txt', fullText, 'utf8');
    console.log('Saved to pdf-text.txt, length:', fullText.length);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

extractPDF();
