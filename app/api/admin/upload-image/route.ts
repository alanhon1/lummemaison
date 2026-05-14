import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const outputDir = path.join(process.cwd(), 'public', 'images', 'products');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `product-${id}.webp`);
  const backupPath = path.join(outputDir, `product-${id}.bak.webp`);

  if (fs.existsSync(outputPath)) {
    fs.renameSync(outputPath, backupPath);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await sharp(buf)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(outputPath);

  return NextResponse.json({ ok: true, path: `/images/products/product-${id}.webp` });
}
