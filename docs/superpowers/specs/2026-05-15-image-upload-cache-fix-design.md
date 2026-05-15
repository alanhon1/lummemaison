# Image Upload Cache Fix — Design

**Date:** 2026-05-15  
**Status:** Approved

## Problem

`/api/admin/upload-image` always saves to the same filename: `product-{id}.webp`.  
After a re-upload the URL is unchanged, so:
- The browser serves the cached old image in the edit page preview.
- Next.js `<Image>` optimization cache also serves the old image on the storefront.
- The file input does not reset, so re-selecting the same file does not trigger `onChange`.

## Fix (Approach A)

### 1. Cache-bust via URL timestamp

In `uploadFile` (`components/admin/ProductEditClient.tsx`), change the line that stores the image path:

```ts
// Before
update('image', data.path);

// After
update('image', `${data.path}?v=${Date.now()}`);
```

The timestamped URL is stored in `products.json` via the existing PATCH call. Every upload produces a unique URL → browser and Next.js Image both see a new resource and re-fetch.

### 2. Reset file input after upload

In `uploadFile`, after `update('image', ...)`:

```ts
if (fileInputRef.current) fileInputRef.current.value = '';
```

Allows re-selecting the same file name without the browser silently ignoring the `onChange`.

### 3. Error notification on save failure

Wrap the edit-mode `fetch` in `handleSave` with a try/catch that calls `alert()` on failure, matching the existing delete-error pattern.

## Scope

- **File changed:** `components/admin/ProductEditClient.tsx` only  
- **No API changes needed**  
- **No schema changes** — `product.image` is already a plain string field
