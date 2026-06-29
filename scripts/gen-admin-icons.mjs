// One-off generator for the admin PWA icons (Phase 3). Produces a distinct
// charcoal+gold "Lumée Admin" mark so the installed admin app looks different
// from the customer app on the home screen.
//   node scripts/gen-admin-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CHARCOAL = '#3A342C';
const GOLD = '#C2A14D';
const CREAM = '#F5F0E8';

// A square mark: charcoal field, a gold serif "L", and a small ADMIN wordmark.
// `pad` adds breathing room for the maskable safe-zone.
function svg(size, { rounded = true, pad = 0 } = {}) {
  const r = rounded ? Math.round(size * 0.18) : 0;
  const inset = Math.round(size * pad);
  const field = size - inset * 2;
  const letterSize = Math.round(field * 0.62);
  const cx = size / 2;
  const ly = size / 2 + letterSize * 0.30;
  const wordY = size / 2 + field * 0.34;
  const wordSize = Math.round(field * 0.11);
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${inset}" y="${inset}" width="${field}" height="${field}" rx="${r}" ry="${r}" fill="${CHARCOAL}"/>
  <text x="${cx}" y="${ly}" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" font-style="italic"
    font-size="${letterSize}" fill="${GOLD}">L</text>
  <text x="${cx}" y="${wordY}" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-weight="600"
    letter-spacing="${Math.round(wordSize * 0.4)}" font-size="${wordSize}" fill="${CREAM}">ADMIN</text>
</svg>`);
}

async function render(name, size, opts) {
  await sharp(svg(size, opts)).png().toFile(join(OUT, name));
  console.log('wrote', name);
}

await render('admin-192.png', 192, { rounded: true });
await render('admin-512.png', 512, { rounded: true });
// Maskable: full-bleed charcoal with the mark inset into the safe zone.
await render('admin-maskable-512.png', 512, { rounded: false, pad: 0.0 });
// Apple touch icon: no rounding (iOS rounds it), opaque.
await render('admin-apple-180.png', 180, { rounded: false });
console.log('done');
