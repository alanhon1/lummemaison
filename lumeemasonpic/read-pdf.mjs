import { readFileSync } from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const data = readFileSync('./APR2026-CATALOGUE.pdf');
const result = await pdfParse(data);
console.log('Pages:', result.numpages);
console.log('=== TEXT ===');
console.log(result.text);
