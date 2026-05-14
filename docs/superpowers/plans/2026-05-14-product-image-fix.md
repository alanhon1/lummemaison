# Product Image Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 438 product images with correct, high-quality webp files by extracting ground-truth images from the catalogue `.doc` file and upgrading them with higher-resolution versions found via internet search.

**Architecture:** A PowerShell script extracts all embedded images from `APR2026- CATALOGUE.doc` via Word COM (convert → .docx → unzip → filter), mapping them positionally to products 1–438. A TypeScript orchestration script then searches DuckDuckGo for each product's official page, extracts the `og:image` or nearest product photo, compares pixel dimensions with the DOC image, and writes the winner as `product-N.webp`. Progress is checkpointed every 10 products so the script can be resumed.

**Tech Stack:** PowerShell Word COM, Node.js/TypeScript, `tsx`, `axios`, `cheerio`, `sharp`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/extract-doc-images.ps1` | Create | Word COM → convert doc → unzip → filter → `temp/doc-images/extracted-N.{png,jpg}` |
| `scripts/fix-product-images.ts` | Create | Main orchestration: load DOC images, search web, pick winner, write webp, update products.json |
| `scripts/progress.json` | Create (at runtime) | Checkpoint: set of completed product IDs |
| `data/products.json` | Modify (at runtime) | `image` field updated to `/images/products/product-N.webp` for each processed product |
| `package.json` | Modify | Add `"fix-images"` and `"extract-doc-images"` npm scripts |

---

## Task 1: PowerShell DOC Extraction Script

**Files:**
- Create: `scripts/extract-doc-images.ps1`

- [ ] **Step 1: Create the extraction script**

Create `scripts/extract-doc-images.ps1` with the following content:

```powershell
param(
    [string]$DocPath = (Join-Path (Split-Path $PSScriptRoot) "APR2026- CATALOGUE.doc"),
    [string]$OutDir  = (Join-Path (Split-Path $PSScriptRoot) "temp\doc-images")
)

New-Item -ItemType Directory -Force $OutDir | Out-Null
$DocPath = (Resolve-Path $DocPath).Path
Write-Host "Opening: $DocPath"

# --- Convert .doc → .docx via Word COM ---
$word = $null
$docxPath = Join-Path $env:TEMP "catalogue-temp.docx"
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $doc = $word.Documents.Open($DocPath)
    $doc.SaveAs2($docxPath, 16)   # 16 = wdFormatXMLDocument (.docx)
    $doc.Close($false)
    Write-Host "Converted to: $docxPath"
} catch {
    Write-Error "Word COM failed: $_"
    exit 1
} finally {
    if ($word) {
        try { $word.Quit() } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}

# --- Unzip .docx ---
$extractDir = Join-Path $env:TEMP "catalogue-docx-extracted"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Expand-Archive -Path $docxPath -DestinationPath $extractDir -Force

$mediaDir = Join-Path $extractDir "word\media"
if (-not (Test-Path $mediaDir)) {
    Write-Error "No word/media directory in docx — document has no embedded images"
    exit 1
}

$mediaFiles = Get-ChildItem $mediaDir -File |
    Where-Object { $_.Extension -match "\.(png|jpg|jpeg|gif|bmp|tiff)$" } |
    Sort-Object Name

Write-Host "Raw media files: $($mediaFiles.Count)"

# --- Filter: skip logos/banners, keep product photos ---
Add-Type -AssemblyName System.Drawing

$productImages = [System.Collections.Generic.List[string]]::new()
foreach ($file in $mediaFiles) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        $w   = $img.Width
        $h   = $img.Height
        $img.Dispose()

        if ($w -lt 100 -or $h -lt 100)     { continue }  # too small (icon/logo)
        if ($h -gt 0 -and ($w / $h) -gt 3) { continue }  # too wide (banner)

        $productImages.Add($file.FullName)
    } catch {
        continue   # skip EMF/WMF vector formats
    }
}

Write-Host "After filter: $($productImages.Count) product images"

# --- Copy with sequential names ---
for ($i = 0; $i -lt $productImages.Count; $i++) {
    $num  = $i + 1
    $src  = $productImages[$i]
    $ext  = [System.IO.Path]::GetExtension($src).ToLower()
    $dest = Join-Path $OutDir "extracted-$num$ext"
    Copy-Item $src $dest
}

Write-Host "COUNT:$($productImages.Count)"
Write-Host "Done. Saved to: $OutDir"
```

- [ ] **Step 2: Add npm script to package.json**

Open `package.json`, find the `"scripts"` block and add:

```json
"extract-doc-images": "powershell -ExecutionPolicy Bypass -File scripts/extract-doc-images.ps1",
"fix-images": "tsx scripts/fix-product-images.ts"
```

- [ ] **Step 3: Run the extraction**

```powershell
npm run extract-doc-images
```

Expected output (last lines):
```
After filter: NNN product images
COUNT:NNN
Done. Saved to: C:\...\temp\doc-images
```

Note the COUNT. It should be ≥ 438. If it's less, the script will still work — products beyond the count will fall back to internet-only.

- [ ] **Step 4: Verify extraction**

```powershell
(Get-ChildItem "temp\doc-images").Count
Get-ChildItem "temp\doc-images" | Select-Object -First 5 | ForEach-Object { Write-Host "$($_.Name) — $([Math]::Round($_.Length/1KB))KB" }
```

Expected: 400+ files, each 20KB+ (the 9KB originals are too small — DOC images should be larger).

- [ ] **Step 5: Commit extraction script**

```powershell
git add scripts/extract-doc-images.ps1 package.json
git commit -m "feat: add doc image extraction script"
```

---

## Task 2: TypeScript Fix-Images Script

**Files:**
- Create: `scripts/fix-product-images.ts`

- [ ] **Step 1: Create the script**

Create `scripts/fix-product-images.ts`:

```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DATA_FILE     = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR    = path.join(process.cwd(), 'public', 'images', 'products');
const DOC_DIR       = path.join(process.cwd(), 'temp', 'doc-images');
const TEMP_DIR      = path.join(process.cwd(), 'temp', 'internet-images');
const PROGRESS_FILE = path.join(process.cwd(), 'scripts', 'progress.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WATERMARK_DOMAINS = [
  'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'istock.com',
  'depositphotos.com', 'alamy.com', 'stock.adobe.com', 'dreamstime.com',
  '123rf.com', 'fotolia.com', 'bigstockphoto.com', 'canstockphoto.com',
  'stockphoto.com', 'vectorstock.com', 'pond5.com', 'offset.com',
];

function isWatermarked(url: string): boolean {
  const u = url.toLowerCase();
  return WATERMARK_DOMAINS.some(d => u.includes(d)) ||
    /\/comp\/|\/preview\/|watermark|_preview\.|_watermark\./.test(u);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Load extracted DOC images → Map<productIndex(1-based), filePath>
function loadDocImages(): Map<number, string> {
  const map = new Map<number, string>();
  if (!fs.existsSync(DOC_DIR)) return map;
  fs.readdirSync(DOC_DIR)
    .filter(f => /^extracted-\d+\.(png|jpg|jpeg)$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0]);
      const nb = parseInt(b.match(/\d+/)![0]);
      return na - nb;
    })
    .forEach(f => {
      const num = parseInt(f.match(/\d+/)![0]);
      map.set(num, path.join(DOC_DIR, f));
    });
  return map;
}

function loadProgress(): Set<number> {
  if (!fs.existsSync(PROGRESS_FILE)) return new Set();
  const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  return new Set<number>(raw.completed ?? []);
}

function saveProgress(completed: Set<number>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ completed: [...completed] }, null, 2), 'utf8');
}

// DuckDuckGo text search → top result page URLs
async function searchWebPages(productName: string): Promise<string[]> {
  try {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: `"${productName}" aesthetic medical product` },
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    const urls: string[] = [];
    $('.result__url').each((_, el) => {
      const href = $(el).text().trim();
      if (href && !href.includes('duckduckgo') && urls.length < 5) {
        urls.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });
    return urls;
  } catch { return []; }
}

// Fetch a page and extract its main product image URL
async function extractProductImageUrl(pageUrl: string, productName: string): Promise<string | null> {
  try {
    const res = await axios.get(pageUrl, {
      headers: { 'User-Agent': UA },
      timeout: 12000,
      maxContentLength: 5 * 1024 * 1024,
    });
    const $ = cheerio.load(res.data);

    // 1. og:image is the most reliable
    const og = $('meta[property="og:image"]').attr('content');
    if (og && og.startsWith('http') && !isWatermarked(og)) return og;

    // 2. Largest img near a heading that contains (part of) the product name
    const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let nearbyImg: string | null = null;
    $('h1, h2').each((_, el) => {
      if (nearbyImg) return;
      const text = $(el).text().toLowerCase();
      const matches = words.filter(w => text.includes(w)).length;
      if (matches >= Math.ceil(words.length / 2)) {
        const src =
          $(el).closest('section, article, div').find('img[src^="http"]').first().attr('src') ||
          $(el).parent().find('img[src^="http"]').first().attr('src');
        if (src && !isWatermarked(src)) nearbyImg = src;
      }
    });
    if (nearbyImg) return nearbyImg;

    // 3. First non-logo img on the page with a product-like URL
    let fallback: string | null = null;
    $('img').each((_, el) => {
      if (fallback) return;
      const src = $(el).attr('src') ?? '';
      if (
        src.startsWith('http') &&
        !isWatermarked(src) &&
        /\.(jpg|jpeg|png|webp)/i.test(src) &&
        !/logo|icon|banner|header|footer|sprite/i.test(src)
      ) {
        fallback = src;
      }
    });
    return fallback;
  } catch { return null; }
}

// Download a URL and convert to webp; returns dimensions on success
async function downloadAndConvert(
  url: string,
  outputPath: string,
  minPx = 150
): Promise<{ ok: boolean; w?: number; h?: number }> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': UA },
      maxContentLength: 20 * 1024 * 1024,
    });
    const buf = Buffer.from(res.data);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || meta.width < minPx || meta.height < minPx) {
      return { ok: false };
    }
    let pipeline = sharp(buf);
    if (meta.width > 1600 || meta.height > 1600) {
      pipeline = pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
    const out = await sharp(outputPath).metadata();
    return { ok: true, w: out.width, h: out.height };
  } catch { return { ok: false }; }
}

// Convert a local DOC image to webp
async function convertDocImage(
  srcPath: string,
  outputPath: string
): Promise<{ ok: boolean; w?: number; h?: number }> {
  try {
    const meta = await sharp(srcPath).metadata();
    if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) {
      return { ok: false };
    }
    let pipeline = sharp(srcPath);
    if (meta.width > 1600 || meta.height > 1600) {
      pipeline = pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
    return { ok: true, w: meta.width, h: meta.height };
  } catch { return { ok: false }; }
}

interface Product { id: number; name: string; image: string; }

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const raw  = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  const products: Product[] = data.products;

  const docImages = loadDocImages();
  const completed = loadProgress();

  console.log(`Products: ${products.length}`);
  console.log(`DOC images: ${docImages.size}`);
  console.log(`Already done: ${completed.size}`);

  let fromInternet = 0, fromDoc = 0, fromOriginal = 0;

  for (let i = 0; i < products.length; i++) {
    const p      = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    if (completed.has(p.id)) {
      process.stdout.write(`${prefix} ↷ ${p.name} (skip)\n`);
      continue;
    }

    const outputPath      = path.join(OUTPUT_DIR, `product-${p.id}.webp`);
    const tempInternetPth = path.join(TEMP_DIR, `internet-${p.id}.webp`);
    const docImagePath    = docImages.get(i + 1) ?? null;

    // --- Internet search ---
    await sleep(1500);
    let internetResult: { ok: boolean; w?: number; h?: number } = { ok: false };
    const pages = await searchWebPages(p.name);
    for (const pageUrl of pages.slice(0, 3)) {
      await sleep(600);
      const imgUrl = await extractProductImageUrl(pageUrl, p.name);
      if (imgUrl) {
        internetResult = await downloadAndConvert(imgUrl, tempInternetPth);
        if (internetResult.ok) break;
      }
    }

    // --- DOC image dimensions ---
    let docMeta: { w: number; h: number } | null = null;
    if (docImagePath && fs.existsSync(docImagePath)) {
      const m = await sharp(docImagePath).metadata().catch(() => null);
      if (m?.width && m?.height) docMeta = { w: m.width, h: m.height };
    }

    // --- Pick winner (more pixels = better) ---
    let source: 'internet' | 'doc' | 'original' = 'original';

    if (internetResult.ok && docMeta && docImagePath) {
      const iPx = (internetResult.w ?? 0) * (internetResult.h ?? 0);
      const dPx = docMeta.w * docMeta.h;
      if (iPx >= dPx) {
        fs.copyFileSync(tempInternetPth, outputPath);
        source = 'internet';
        fromInternet++;
        process.stdout.write(`${prefix} ✓ ${p.name} — internet (${internetResult.w}×${internetResult.h})\n`);
      } else {
        const r = await convertDocImage(docImagePath, outputPath);
        if (r.ok) { source = 'doc'; fromDoc++; }
        process.stdout.write(`${prefix} ✓ ${p.name} — doc (${docMeta.w}×${docMeta.h})\n`);
      }
    } else if (internetResult.ok) {
      fs.copyFileSync(tempInternetPth, outputPath);
      source = 'internet'; fromInternet++;
      process.stdout.write(`${prefix} ✓ ${p.name} — internet only (${internetResult.w}×${internetResult.h})\n`);
    } else if (docMeta && docImagePath) {
      const r = await convertDocImage(docImagePath, outputPath);
      if (r.ok) { source = 'doc'; fromDoc++; }
      process.stdout.write(`${prefix} ✓ ${p.name} — doc only (${docMeta.w}×${docMeta.h})\n`);
    } else {
      fromOriginal++;
      process.stdout.write(`${prefix} ✗ ${p.name} — no image found, keeping original\n`);
    }

    if (source !== 'original') {
      data.products[i].image = `/images/products/product-${p.id}.webp`;
    }

    completed.add(p.id);

    // Checkpoint every 10
    if ((i + 1) % 10 === 0 || i === products.length - 1) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      saveProgress(completed);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  saveProgress(completed);
  console.log(`\nDone. Internet: ${fromInternet} | DOC: ${fromDoc} | Original (unchanged): ${fromOriginal}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Smoke-test the script on a single product**

Before running all 438, test on just product 1 to confirm the search and download pipeline works. Temporarily add this at the top of `main()` just after `loadProgress()`:

```typescript
// TEMP SMOKE TEST — remove after verifying
products.splice(1); // keep only product 1
```

Run:
```powershell
npm run fix-images
```

Expected output:
```
[1/1] ✓ BARBIE SLIM — internet (NNNxNNN)   (or "doc" or "no image found")
Done. Internet: 1 | DOC: 0 | Original: 0
```

Check the output file exists and opens as a real BARBIE SLIM photo:
```powershell
(Get-Item "public\images\products\product-1.webp").Length / 1KB
```
Expected: > 20KB.

- [ ] **Step 3: Remove smoke-test line, reset progress, run full script**

Remove `products.splice(1);` from the script.

Delete the progress file so the full run starts clean:
```powershell
if (Test-Path scripts/progress.json) { Remove-Item scripts/progress.json }
```

Run the full script (takes ~20-30 minutes for 438 products):
```powershell
npm run fix-images
```

If it is interrupted, re-running automatically resumes from the last checkpoint.

- [ ] **Step 4: Verify results**

```powershell
# Count new webp files
(Get-ChildItem "public\images\products" -Filter "product-*.webp").Count
```
Expected: close to 438.

```powershell
# Check products.json — how many still have old jpg paths
node -e "const d=require('./data/products.json'); const old=d.products.filter(p=>p.image&&p.image.includes('.jpg')); console.log('Still jpg:', old.length); old.slice(0,5).forEach(p=>console.log(p.id, p.name))"
```
Expected: small number (products internet + DOC couldn't help).

```powershell
# Check summary line at end of script output
# "Done. Internet: X | DOC: Y | Original: Z"
# X + Y should be close to 438
```

- [ ] **Step 5: Commit**

```powershell
git add scripts/fix-product-images.ts data/products.json public/images/products/
git commit -m "feat: fix all product images via doc extraction + internet search"
```

Note: `scripts/progress.json` is a runtime checkpoint file — do not commit it. Add it to `.gitignore` if not already there:
```powershell
Add-Content .gitignore "`nscripts/progress.json"
```

---

## Task 3: Push and Verify on Vercel

- [ ] **Step 1: Push to GitHub**

```powershell
git push
```

- [ ] **Step 2: Check Vercel deploy**

Wait for the Vercel auto-deploy to finish (1-2 minutes), then open the live site and visit a few product pages to confirm the images are correct and load quickly.

Key products to manually spot-check (the ones that were previously wrong):
- Product 1: BARBIE SLIM
- Product 2: MisAdi Beso  
- Check a few near product 50 where webp/jpg boundary was

- [ ] **Step 3: Handle any remaining missing images (optional)**

Check the final summary line from the script output: `Done. Internet: X | DOC: Y | Original: Z`. The `Z` (Original) count is products that had no internet or DOC image found. To see which products they are:

```powershell
node -e "const d=require('./data/products.json'); d.products.filter(p=>p.image&&!p.image.includes('product-')).forEach(p=>console.log(p.id, p.name, p.image))"
```

Upload images for those products manually via the admin panel at `/manzura/products`.
