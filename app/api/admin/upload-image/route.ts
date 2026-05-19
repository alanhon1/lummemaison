import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || 'unknown'}. Use JPG, PNG, WebP, AVIF, or GIF.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 10MB).` },
      { status: 400 },
    );
  }

  const outputDir = path.join(process.cwd(), 'public', 'images', 'products');
  fs.mkdirSync(outputDir, { recursive: true });

  // Always write to a versioned filename so we never have to overwrite a
  // file that the browser or Next.js image cache might still be holding
  // open. Old files become orphans (cleaned up by a separate script later).
  const versionTag = Date.now();
  const outputName = `product-${id}-${versionTag}.webp`;
  const outputPath = path.join(outputDir, outputName);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await sharp(buf)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(outputPath);
  } catch (err) {
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
    }
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Image processing failed', detail },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, path: `/images/products/${outputName}` });
}
