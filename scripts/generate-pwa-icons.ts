// scripts/generate-pwa-icons.ts — run: npx tsx scripts/generate-pwa-icons.ts
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'icons');
const GOLD = '#A88A4A';
const CREAM = '#F5F0E8';

// A full-bleed gold tile with a centred cream "L" (serif). `pad` leaves safe
// area for maskable icons. `mono` makes a transparent tile with a white "L"
// for the Android notification badge.
function svg(size: number, pad: number, mono: boolean): Buffer {
  const bg = mono ? 'none' : GOLD;
  const fg = mono ? '#FFFFFF' : CREAM;
  const fontSize = Math.round(size * (1 - pad * 2) * 0.9);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       <rect width="${size}" height="${size}" rx="${mono ? 0 : Math.round(size * 0.18)}" fill="${bg}"/>
       <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
             font-family="Georgia, 'Times New Roman', serif" font-weight="500"
             font-size="${fontSize}" fill="${fg}">L</text>
     </svg>`,
  );
}

async function png(size: number, pad: number, mono: boolean, name: string) {
  await sharp(svg(size, pad, mono)).png().toFile(join(OUT, name));
  console.log('  wrote', name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await png(192, 0.1, false, 'icon-192.png');
  await png(512, 0.1, false, 'icon-512.png');
  await png(512, 0.2, false, 'maskable-512.png'); // extra safe-area padding
  await png(180, 0.1, false, 'apple-touch-180.png');
  await png(72, 0.15, true, 'badge-72.png'); // monochrome, transparent
  console.log('✓ pwa icons generated');
}

main();
