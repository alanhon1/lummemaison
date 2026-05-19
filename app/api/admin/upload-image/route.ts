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

  const outputPath = path.join(outputDir, `product-${id}.webp`);
  const backupPath = path.join(outputDir, `product-${id}.bak.webp`);
  const tmpPath = path.join(outputDir, `product-${id}.tmp-${Date.now()}.webp`);

  // Best-effort backup. If the file is locked (Windows EBUSY because the
  // browser still has it open), skip the rename and let sharp overwrite.
  let backupCreated = false;
  if (fs.existsSync(outputPath)) {
    try {
      fs.copyFileSync(outputPath, backupPath);
      backupCreated = true;
    } catch {
      /* ignore — proceed without backup */
    }
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await sharp(buf)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(tmpPath);

    // Replace the live file with the tmp output. On Windows this can fail
    // with EBUSY if the OS still has a handle; retry a couple of times.
    let renamed = false;
    for (let attempt = 0; attempt < 3 && !renamed; attempt++) {
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.renameSync(tmpPath, outputPath);
        renamed = true;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 150));
      }
    }
  } catch (err) {
    // Restore backup if available.
    if (backupCreated && fs.existsSync(backupPath)) {
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.copyFileSync(backupPath, outputPath);
      } catch {
        /* ignore */
      }
    }
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Image processing failed', detail },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, path: `/images/products/product-${id}.webp` });
}
