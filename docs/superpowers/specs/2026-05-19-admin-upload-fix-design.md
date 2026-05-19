# Admin Image Upload Fix — Design

Date: 2026-05-19
Owner: alanhon1

## Problem

The `/manzura` admin product editor consistently fails on image upload:

- A generic "Upload failed" message appears regardless of the underlying
  cause (size, format, sharp error).
- Even when upload succeeds server-side, the storefront doesn't reflect
  the new image because the editor only mutates the form's local
  `image` field — the user must click *Save* explicitly to PATCH
  `data/products.json`, and many users miss this step.
- Large phone-camera JPEGs (3-10 MB) hit Next.js's default body-size
  limit and bounce.

## Source of truth

The Sharp library decides which formats are actually processable.
File-system writes go to `public/images/products/product-{id}.webp`.

## Non-goals

- No PDF / spec-sheet upload (image only).
- No multi-image-per-product gallery (one image per product).
- No auto-save after upload (explicit user request to keep the manual
  Save step but signal it clearly).
- No production-only fixes — work covers localhost first and the same
  code paths run on the deployed site.

## Design

### A. `app/api/admin/upload-image/route.ts`

1. **MIME whitelist** before invoking sharp:

   `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`.
   Any other type → return 400 with
   `{ error: "Unsupported file type: <type>" }`.

2. **Size guard** at 10 MB:

   `if (file.size > 10 * 1024 * 1024)` → return 400 with
   `{ error: "File too large (Xmb > 10mb)" }`.

3. **Real error surfacing** from the sharp catch:

   ```ts
   return NextResponse.json({
     error: 'Image processing failed',
     detail: err instanceof Error ? err.message : String(err),
   }, { status: 400 });
   ```

4. **Backup-rename** logic stays as-is (failed write restores the
   `.bak.webp`).

### B. `next.config.ts`

Add a route-handler body size limit:

```ts
experimental: {
  serverActions: { bodySizeLimit: '10mb' },
},
```

(Next.js App Router route handlers don't enforce a default ceiling like
the legacy Pages bodyParser, but the `serverActions.bodySizeLimit`
config also raises the limit for `formData()` parsing in App Router
under most adapters.)

### C. `components/admin/ProductEditClient.tsx`

1. **Client-side MIME check** in `uploadFile` before posting:

   ```ts
   const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
   if (!ALLOWED.includes(file.type)) {
     setUploadError(`Unsupported file type: ${file.type}. Use JPG, PNG, WebP, AVIF, or GIF.`);
     setUploading(false);
     return;
   }
   ```

2. **Read server error** instead of swallowing:

   ```ts
   if (!res.ok) {
     const data = await res.json().catch(() => ({}));
     throw new Error(data.detail || data.error || `HTTP ${res.status}`);
   }
   ```

3. **Save-needed reminder** — add a new state `uploadSuccess`:

   - `uploadFile` sets it to `true` on success.
   - `handleSave` clears it to `false` after a successful PATCH.
   - JSX block under the drop zone (next to the existing
     `uploadError`):

     ```tsx
     {uploadSuccess && (
       <p className="text-amber-600 text-xs mt-1 font-semibold">
         Upload OK — click Save (top right) to apply to the catalogue.
       </p>
     )}
     ```

4. **Drag-and-drop client check** — apply the same MIME validation to
   `handleDrop` (currently bypasses the check by calling `uploadFile`
   directly with the dropped file).

## Verification

- Localhost: upload a 4 MB JPG → success + amber "click Save" message
  → click Save → storefront reloads with new image.
- Upload a PDF → red error "Unsupported file type: application/pdf".
- Upload an 11 MB image → red error "File too large (10.x MB > 10mb)".
- Upload a corrupted file (rename `.txt` to `.jpg`) → red error with
  sharp's actual message (e.g. "Input buffer contains unsupported
  image format").
- `npx tsc --noEmit` passes.

## Rollback

`git revert <commit-sha>` on each of the three modified files. No data
mutation outside `data/products.json` (which only happens after the
user clicks Save).

## Out of scope

- PDF / spec-sheet upload (separate endpoint).
- Multi-image gallery per product.
- Auto-save after upload (user opted for manual + reminder).
- Production deploy fixes — only relevant if Vercel writes-fs-back
  fails, which is a separate hosting concern.
