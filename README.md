# Lumière — B2B Korean Aesthetic Cosmetics Catalog

**SH Core Stetics Global (Skin Global)** — wholesale export platform for premium Korean medical-grade aesthetic products.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-based config) |
| i18n | next-intl 4.x (EN / RU / KO) |
| State | Zustand with localStorage persistence |
| Search | Fuse.js (fuzzy, threshold 0.4) |
| Animation | Framer Motion |
| Icons | lucide-react |

## Project Structure

```
lumiere-app/
├── app/
│   ├── [locale]/             # All pages under locale prefix (/en, /ru, /ko)
│   │   ├── page.tsx          # Home
│   │   ├── catalogue/        # Product catalogue + [category] filter
│   │   ├── product/[id]/     # Product detail
│   │   ├── about/            # About page
│   │   ├── contact/          # Contact page
│   │   ├── cart/             # Cart page
│   │   ├── checkout/         # Checkout + shipping form
│   │   ├── payment/          # Payment instructions
│   │   └── admin/            # Admin panel
│   ├── api/admin/            # Protected REST API (auth, products CRUD)
│   ├── globals.css           # Tailwind v4 theme + custom components
│   └── layout.tsx            # Root layout (fonts)
├── components/
│   ├── layout/               # Header, Footer, CartPanel, FloatingWhatsApp
│   ├── home/                 # Hero, CategoryGrid, WhyChooseUs, CTASection
│   ├── catalogue/            # ProductCard, CatalogueClient, ProductDetailClient
│   ├── checkout/             # CartPageClient, CheckoutClient, PaymentClient
│   └── admin/                # AdminClient
├── data/
│   └── products.json         # 438 products, 20 categories (parsed from PDF)
├── lib/
│   ├── site-config.ts        # EDIT THIS for contact/payment/social info
│   ├── products.ts           # Product helpers (search, filter, sort)
│   ├── store.ts              # Zustand cart store
│   └── i18n.ts               # Locale list + defaultLocale
├── messages/
│   ├── en.json               # English translations
│   ├── ru.json               # Russian translations
│   └── ko.json               # Korean translations
├── i18n/request.ts           # next-intl server config
├── proxy.ts                  # Next.js 16 routing (replaces middleware.ts)
├── public/
│   └── APR2026-CATALOGUE.pdf # PDF catalogue (served as download)
├── .env.local                # Environment variables
└── HOW-TO-MANAGE.md          # Korean guide for non-technical users
```

## Setup

```bash
npm install
npm run dev       # development server at http://localhost:3000
npm run build     # production build
npm start         # serve production build
```

## Environment Variables (`.env.local`)

```env
ADMIN_PASSWORD=changeme123
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Change `ADMIN_PASSWORD` before deploying to production.**

## Customization

### Business info — `lib/site-config.ts`
All contact info, social links, payment details, and shipping rates live here. This is the only file you need to edit for business info changes:
- Email, WhatsApp number, Telegram handle
- Social media URLs
- Wise account name and USDT TRC-20 wallet address
- FedEx shipping rates

### Translations — `messages/[locale].json`
Edit `en.json`, `ru.json`, `ko.json` to change any UI text.

### Products — `data/products.json`
Managed via the admin panel at `/en/admin`. You can also edit the JSON directly. Each product has:
```json
{
  "id": 1,
  "name": "Product Name",
  "category": "Category Name",
  "price": 99.99,
  "spec": "Volume/size info",
  "description": "Product description",
  "image": "/images/products/1.jpg",
  "tags": ["NEW", "BESTSELLER"],
  "inStock": true
}
```

## Key Architectural Notes

### Next.js 16 specifics
- **`proxy.ts`** (not `middleware.ts`) handles locale routing.
- **Async params**: All page/layout components must `await params` before use.
- **Turbopack** is the default bundler.

### Tailwind v4
- No `tailwind.config.ts` — all config is in `app/globals.css` via `@theme inline`.
- Custom colors: `cream`, `gold`, `obsidian`, `charcoal`, `bone`, `mist`.
- Custom components: `.btn-primary`, `.btn-gold`, `.product-card`, `.glassmorphism`.

### i18n (next-intl)
- Locales: `en` (default), `ru`, `ko`.
- All routes prefixed: `/en/catalogue`, `/ru/catalogue`, `/ko/catalogue`.
- Server components: `getTranslations()` | Client components: `useTranslations()`.

### Cart (Zustand)
- Persisted in `localStorage` key `lumiere-cart`.
- Sliding panel controlled by `isOpen`/`openCart`/`closeCart` in the store.

## Admin Panel

URL: `/en/admin`

Default password: `changeme123` (set via `ADMIN_PASSWORD` in `.env.local`).

Features:
- View all 438 products in a searchable table
- Edit name, price, spec, description, image URL, tags
- Toggle in-stock status
- Delete products
- Changes write directly to `data/products.json`

## Payment Flow

1. Customer fills checkout form → selects **Wise** or **USDT (TRC-20)**
2. Order ID generated: `LUM-YYYYMMDD-XXXX`
3. Payment instructions shown with copy-to-clipboard
4. Customer sends payment; you confirm via WhatsApp/Telegram

## Deployment Notes

For Vercel:
1. Push to GitHub, import in Vercel
2. Set env vars: `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`
3. **Important**: `data/products.json` writes won't persist on Vercel (serverless, read-only filesystem). For production admin editing, migrate to Vercel KV, Supabase, or another database.

## Re-parsing the Catalogue PDF

```bash
# Place new PDF in project root as "APR2026- CATALOGUE.pdf", then:
node extract-pdf.js        # extracts text → pdf-text.txt
node parse-products2.js    # parses products → data/products.json
cp "APR2026- CATALOGUE.pdf" public/APR2026-CATALOGUE.pdf
```
