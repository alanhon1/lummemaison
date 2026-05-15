const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const data = fs.readFileSync('./APR2026-CATALOGUE.pdf');
const parser = new PDFParse();
parser.parse(data).then(result => {
  console.log('Pages:', result.numpages);
  console.log('=== TEXT ===');
  console.log(result.text);
}).catch(err => {
  console.error(err);
  // fallback: try default export
  const m = require('pdf-parse');
  console.log('All exports:', Object.keys(m));
});
