// HEIC → JPEG conversion with a Sharp-first, heic-convert-fallback strategy.
//
// Why two paths: Sharp can decode HEIC only when its prebuilt libvips binary
// is linked against libheif. The npm-distributed prebuilts (especially on
// Vercel's linux-x64 runtime) are usually compiled without libheif, so an
// HEIC buffer that decodes locally on macOS will throw in production. The
// `heic-convert` package ships a pure-JS libheif WebAssembly build that runs
// anywhere — slower, but reliable. We always run the result back through
// Sharp for EXIF rotation + re-encode to JPEG quality 88.

import sharp from 'sharp';

const JPEG_QUALITY = 88;

export async function heicToJpegBuffer(input: Buffer): Promise<Buffer> {
  // Path 1 — Sharp handles HEIC directly. Fast, no extra decode step.
  try {
    return await sharp(input).rotate().jpeg({ quality: JPEG_QUALITY }).toBuffer();
  } catch {
    // fall through to heic-convert
  }

  // Path 2 — Decode via heic-convert (libheif WASM), then re-encode through
  // Sharp so we still get auto-rotate and consistent JPEG output.
  const heicConvert = (await import('heic-convert')).default;
  const decoded = await heicConvert({
    buffer: input as unknown as ArrayBufferLike,
    format: 'JPEG',
    quality: 0.92,
  });
  const buf = Buffer.from(decoded);
  return sharp(buf).rotate().jpeg({ quality: JPEG_QUALITY }).toBuffer();
}
