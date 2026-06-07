import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-guard';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);
const MAX_SIZE = 10 * 1024 * 1024;
const BUCKET = 'product-images';

// Uploads a product image to the public `product-images` Supabase Storage
// bucket and returns its public URL. Storage (not the local filesystem) is the
// durable home — Vercel's runtime FS is read-only, so disk writes don't persist.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
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

  // Versioned object name so a re-upload never collides with a cached URL.
  const objectPath = `product-${id}/${Date.now()}.webp`;

  let webp: Buffer;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    webp = await sharp(buf)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Image processing failed', detail }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, webp, { upsert: true, contentType: 'image/webp' });
  if (uploadError) {
    return NextResponse.json(
      { error: 'Storage upload failed', detail: uploadError.message },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
