# Lumière App — Full Upgrade Design Spec
**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** 5 tasks — Category Icons, Image Download, Description Enrichment, Admin System, Product Page Redesign

---

## Context

Existing state:
- Next.js 16 + TypeScript + Tailwind v4 + framer-motion + fuse.js + next-intl + zustand
- 438 products in `data/products.json`, 20 categories
- Basic admin exists at `/[locale]/admin` (password-header auth, no session) → will be deleted
- No `middleware.ts`, no `scripts/` folder, no iron-session, no sharp
- Deployed on Vercel; admin edits files locally, user pushes to GitHub → Vercel redeploys

---

## Task 1: Category Emoji → Gold Lucide Icons

**File:** `components/home/CategoryGrid.tsx`

Replace `CATEGORY_EMOJIS` dictionary with a `CATEGORY_ICONS` map of Lucide React components.

Icon mapping:
| Category ID | Lucide Icon |
|---|---|
| fillers | `Droplets` |
| mesotherapy | `Sparkles` |
| acne-treatment | `FlaskConical` |
| hair-treatment | `Scissors` |
| pharmacy-favourites | `Pill` |
| topical-cosmetics | `Layers` |
| intimate-care | `Heart` |
| growth-factor-exosome | `Dna` |
| curenex | `Zap` |
| dermagen | `Shield` |
| gtm | `Gem` |
| equipment | `Microscope` |
| salon-grade | `Brush` |
| lipolytics | `Target` |
| botulinum | `Syringe` |
| injections | `Activity` |
| anesthetics | `Pill` |
| placental-therapy | `Leaf` |
| nano-needle-cannula | `PenLine` |
| imported-products | `Globe` |

Card design:
- Background: `bg-cream` (was `bg-white`)
- Border: `border border-gold/20` (was `border-bone`)
- Hover: `hover:border-gold hover:shadow-md hover:-translate-y-1 transition-all duration-300`
- Icon: `text-gold` with `strokeWidth={1.5}`, size 22
- Icon hover: `group-hover:text-gold-dark transition-colors duration-300`
- Fallback icon: `Package` for unknown category IDs

---

## Task 2: Product Image Auto-Download Script

**File:** `scripts/fetch-product-images.ts`  
**Run:** `npm run fetch-images`  
**New packages:** `sharp`, `axios`, `tsx` (devDep)

### Search Pipeline (per product)

Three-pass DuckDuckGo unofficial image search:
1. `"{name} {spec_keywords} product"`
2. `"{name} Korean cosmetic"`
3. `"{name} filler injection"`

DuckDuckGo image API flow:
1. GET `https://duckduckgo.com/?q={query}&iax=images&ia=images` → extract `vqd` token from HTML
2. GET `https://duckduckgo.com/i.js?q={query}&o=json&l=us-en&s=0&f=,,,&vqd={token}` → get image results JSON

### Matching Score (0–1)
- Product name keywords in image URL: +0.4
- Product name keywords in image title/alt: +0.3
- Extension is jpg/png/webp: +0.1
- URL contains "product", "item", "pack": +0.2
- URL contains "banner", "ad", "logo", "person", "model": −0.3
- Threshold: **0.7** — below this, try next candidate or next query pass

### Image Processing (sharp)
- Skip if resolved dimensions < 400px on either axis
- Convert to webp, quality 90
- Downscale to max 1600×1600 if larger (preserve aspect ratio)
- No upscaling
- Save to `public/images/products/product-{id}.webp`

### products.json Update
- Set `image: "/images/products/product-{id}.webp"` on success
- Leave `image: ""` on failure

### Output
```
[1/438]  ✓ BARBIE SLIM (score: 0.82, 1024×1024)
[2/438]  ✗ XYZ PRODUCT (no match ≥ 0.7)
```
Failed products logged to `public/missing-images.txt` (ID + name).

### Rate Limiting
- 2s between search queries
- 0.5s between image downloads

---

## Task 3: Description Enrichment Script

**File:** `scripts/enrich-product-descriptions.ts`  
**Run:** `npm run enrich-descriptions`  
**New packages:** `cheerio` (devDep or dep)

### Search Pipeline (per product)

DuckDuckGo text search → extract top 3 URLs → axios fetch each page → cheerio parse.

Target sites (preferred): manufacturer sites, large wholesale sites, medical info sites.

Extraction targets from page text:
- **benefits**: bullet/list items near product name → 3–5 items
- **treatmentAreas**: keyword matching (face, neck, lips, hands, body, scalp, etc.)
- **ingredients**: HA, lidocaine, PDRN, exosome, peptide, etc. keyword detection
- **duration**: regex patterns like "12 months", "6–12 months", "up to 18 months"
- **protocol**: paragraph containing dosage/usage instructions

### products.json Update
Adds `enrichedInfo` field only when at least `benefits` or `ingredients` is found:
```json
{
  "enrichedInfo": {
    "benefits": ["Long-lasting volume", "Natural results"],
    "treatmentAreas": ["nasolabial folds", "lips"],
    "ingredients": "Hyaluronic acid 24mg/ml, Lidocaine 0.3%",
    "duration": "12–18 months",
    "protocol": "Inject subdermally using 27G needle..."
  }
}
```
If nothing found: no `enrichedInfo` field added, existing data untouched.

### Type Addition (`lib/products.ts`)
```typescript
export interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}
// Added to Product interface:
enrichedInfo?: EnrichedInfo;
```

---

## Task 4: Admin System (`/manzura`)

### Route Structure

```
app/
  (admin)/
    manzura/
      layout.tsx              Admin-only layout (no site header/footer)
      page.tsx                Dashboard
      login/
        page.tsx              Login
      products/
        page.tsx              Product list + search
        [id]/
          page.tsx            Individual product edit
      categories/
        page.tsx              Category management
      settings/
        page.tsx              Site settings
  [locale]/
    admin/                    DELETED
components/
  admin/
    AdminClient.tsx           DELETED
    dashboard/DashboardClient.tsx
    products/ProductsClient.tsx
    products/ProductEditClient.tsx
api/
  admin/
    auth/route.ts             REPLACED (iron-session)
    logout/route.ts           NEW
    products/route.ts         ENHANCED (backup on write)
    products/[id]/route.ts    ENHANCED (backup on write)
    upload-image/route.ts     NEW
    backup/route.ts           NEW
middleware.ts                 NEW
```

### Authentication

**Package:** `iron-session`

Session config:
```typescript
{
  cookieName: 'lumiere_admin_session',
  password: process.env.SESSION_SECRET, // 32+ chars
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  }
}
```

Session data shape: `{ username: string; loggedIn: boolean }`

### Environment Variables (.env.local additions)
```
ADMIN_USERNAME=manzura
ADMIN_PASSWORD=Alanhon1_
SESSION_SECRET=<auto-generated 32+ char random string>
```

### Middleware (`middleware.ts`)

Single middleware handles both concerns:
- `/manzura/login` → pass through (no auth check)
- `/manzura/*` → check iron-session cookie → redirect to `/manzura/login` if missing
- `/api/admin/*` → check iron-session cookie → 401 if missing
- All other paths → next-intl locale middleware

### Login Page (`/manzura/login`)

Design:
- Full-screen cream background, centered white card
- Gold thin border (`border border-gold/30`), soft shadow
- Title: "Lumière Admin" in Cormorant Garamond, font-light
- Fields: Username + Password (Jost / Inter)
- Gold login button (`btn-gold`)
- Error: "Invalid credentials" fade-in below form on failure
- Redirect to `/manzura` on success

### Dashboard (`/manzura`)

4 stat cards:
- Total Products (count from products.json)
- Total Categories (count from products.json)
- Products Without Images (count where `image === ""`)
- Last Modified (timestamp from most recent backup or file mtime)

Quick actions:
- "New Product" → `/manzura/products/new` (renders same ProductEditClient with empty defaults; POST to `/api/admin/products` on save to append new product with auto-incremented ID)
- "View Missing Images" → `/manzura/products?filter=no-image`
- "Download Backup" → triggers backup JSON download

Recent edits list: last 5 modified products (from backup log).

### Product List (`/manzura/products`)

- Fuzzy search (fuse.js, already installed) across name + ID + category
- Filters: category dropdown, image presence (all / has image / no image)
- Table columns: checkbox | # | thumbnail (40px) | name | price | category | status | actions
- Pagination: 50 per page
- Bulk select: select all on page + cross-page selection count
- Bulk actions (shown when ≥1 selected): price adjustment (% or fixed), category change, tag add/remove, delete

### Product Edit (`/manzura/products/[id]`)

Left column — Image:
- Shows current image (or placeholder)
- Drag & drop upload zone
- On upload: POST to `/api/admin/upload-image` → sharp converts to webp → saves to `public/images/products/product-{id}.webp` → old file auto-renamed to `product-{id}.bak.webp`
- Preview updates immediately

Right column — Tabs:
- **Basic**: name, specification, description, price (number), MOQ (number), category (select), tags (comma-separated input), isNew/isSale/isBestSeller/inStock (checkboxes)
- **Enriched Info**: benefits (textarea, one per line), treatmentAreas (comma input), protocol (textarea), ingredients (text), duration (text)
- **Languages** (categories only): category name fields for EN / RU / KO (product info is English-only for now)

Page-level unsaved changes warning: `beforeunload` event when form is dirty.

Action buttons: [Save] [Cancel] [Delete] — Delete requires `confirm()`.

### Image Upload API (`/api/admin/upload-image`)

- `multipart/form-data`, field name: `file`, query param: `id`
- Auth: iron-session check
- Processing: sharp → webp, quality 90, max 1600×1600
- Backup existing: rename `product-{id}.webp` → `product-{id}.bak.webp` before writing
- Returns: `{ ok: true, path: "/images/products/product-{id}.webp" }`

### Backup System

On every PATCH/DELETE/POST to products API:
1. Copy current `data/products.json` → `data/backups/products-{ISO8601}.json`
2. Prune: delete oldest files if count > 30

Backup restore API (`/api/admin/backup`):
- GET: list backups (filename + size + timestamp)
- POST `{ filename }`: copy backup → `data/products.json` (with pre-restore backup first)

### Category Management (`/manzura/categories`)

Table of all 20 categories. Each row: ID | Name (EN) | Name (RU) | Name (KO) | Range | Edit button.
Edit opens inline form to update the three language names.
Saves via PATCH `/api/admin/categories` (new route, writes to `data/products.json` categories array).
No add/delete category (range management too complex; categories are structural).

### Site Settings (`/manzura/settings`)

Editable fields from `lib/site-config.ts`:
- WhatsApp number
- Contact email
- Telegram handle (if present)
- Site name / tagline

Saves via PATCH `/api/admin/settings` which writes to `lib/site-config.ts` directly (simple JSON replacement).

### Security

- `/manzura/*` and `/api/admin/*` gated by middleware (iron-session)
- `robots.txt`: `Disallow: /manzura`
- Admin layout sets `<meta name="robots" content="noindex,nofollow">`
- No CSRF token needed (iron-session cookie is httpOnly + SameSite=Lax by default)
- Credentials stored only in `.env.local` (already in `.gitignore`)

---

## Task 5: Cleanup & Documentation

### Product Page (`/product/[id]`) Redesign
- Left image column: `lg:sticky lg:top-28` (sticks while scrolling info)
- Tabs (client component, framer-motion fade): Description / Benefits / How to Use / Ingredients
- Tabs only render when `enrichedInfo` exists; otherwise shows current plain layout
- Related products section: unchanged (already exists)

### New npm Scripts (package.json)
```json
"fetch-images": "tsx scripts/fetch-product-images.ts",
"enrich-descriptions": "tsx scripts/enrich-product-descriptions.ts"
```

### README.md additions
```markdown
## Admin
Local admin panel at http://localhost:3000/manzura

## Scripts
npm run fetch-images        # Download product images (438 products)
npm run enrich-descriptions # Enrich product descriptions from web
```

### HOW-TO-MANAGE.md (Korean, for mom)
- Admin 접속 방법 (`/manzura`)
- 상품 편집 방법 (이미지 교체, 가격 변경)
- 백업 복원 방법
- GitHub push → Vercel 자동 배포 설명

---

## New Packages Required

| Package | Type | Purpose |
|---|---|---|
| `iron-session` | dependency | Admin session management |
| `sharp` | dependency | Image resize + webp conversion |
| `axios` | dependency | HTTP requests in scripts |
| `cheerio` | dependency | HTML parsing in scripts |
| `tsx` | devDependency | Run TypeScript scripts directly |

---

## Subagent Work Division

| Agent | Tasks |
|---|---|
| A | Task 1 (category icons) + Task 5a (product page redesign) |
| B | Task 2 (image download script) |
| C | Task 3 (description enrichment script) |
| D | Task 4 auth: middleware.ts + iron-session + login page + API routes |
| E | Task 4 UI: dashboard + product list + product edit pages |
| F | Task 4 API: upload-image + backup system + HOW-TO-MANAGE.md |

Final step (sequential, after all agents): `npm run build` to verify zero errors.
