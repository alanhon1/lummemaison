import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const BUNDLES_IMG_DIR = path.join(ROOT, 'public', 'images', 'bundles');
const PLACEHOLDER = path.join(BUNDLES_IMG_DIR, '_placeholder.webp');
const CANVAS = 800;

export interface BundleMember {
  image: string;
}

export interface BundleComposeResult {
  outputPath: string;
  usedPlaceholders: number;
}

function gridFor(n: number): { rows: number; cols: number; take: number } {
  if (n <= 1) return { rows: 1, cols: 1, take: 1 };
  if (n === 2) return { rows: 1, cols: 2, take: 2 };
  if (n <= 4) return { rows: 2, cols: 2, take: n };
  if (n <= 6) return { rows: 2, cols: 3, take: n };
  return { rows: 3, cols: 3, take: Math.min(9, n) };
}

async function ensurePlaceholder(): Promise<void> {
  if (fs.existsSync(PLACEHOLDER)) return;
  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: '#e5e5e5' },
  })
    .webp({ quality: 80 })
    .toFile(PLACEHOLDER);
}

export async function composeBundleCover(
  groupId: string,
  members: BundleMember[],
): Promise<BundleComposeResult> {
  if (!fs.existsSync(BUNDLES_IMG_DIR)) fs.mkdirSync(BUNDLES_IMG_DIR, { recursive: true });
  await ensurePlaceholder();

  const { rows, cols, take } = gridFor(members.length);
  const cellW = Math.floor(CANVAS / cols);
  const cellH = Math.floor(CANVAS / rows);

  const composites: sharp.OverlayOptions[] = [];
  let usedPlaceholders = 0;

  for (let i = 0; i < take; i++) {
    const m = members[i];
    let srcAbs: string;
    if (m.image && m.image.startsWith('/images/products/')) {
      srcAbs = path.join(ROOT, 'public', m.image);
    } else {
      srcAbs = PLACEHOLDER;
    }
    if (!fs.existsSync(srcAbs) || fs.statSync(srcAbs).size === 0) {
      srcAbs = PLACEHOLDER;
      usedPlaceholders++;
    }

    const cellBuf = await sharp(srcAbs)
      .resize(cellW, cellH, { fit: 'contain', background: '#ffffff' })
      .toBuffer();

    const left = (i % cols) * cellW;
    const top = Math.floor(i / cols) * cellH;
    composites.push({ input: cellBuf, left, top });
  }

  const outputName = `bundle-${groupId}.webp`;
  const outputPath = path.join(BUNDLES_IMG_DIR, outputName);

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite(composites)
    .webp({ quality: 85 })
    .toFile(outputPath);

  return { outputPath: `/images/bundles/${outputName}`, usedPlaceholders };
}
