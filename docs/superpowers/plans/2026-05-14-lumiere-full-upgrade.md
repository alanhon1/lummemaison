# Lumière Full Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gold Lucide icons, product image auto-download, description enrichment, and a full `/manzura` admin panel to the existing Lumière Next.js 16 app.

**Architecture:** Route group `app/(admin)/manzura/` sits completely outside `[locale]` routing. iron-session handles admin auth via httpOnly cookie. A new `middleware.ts` gates `/manzura/*` and `/api/admin/*` routes. Scripts run via `tsx` and use DuckDuckGo unofficial image API + cheerio web scraping — no paid API keys needed.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, iron-session v8, sharp, axios, cheerio, tsx, lucide-react (already installed), framer-motion (already installed)

---

## Task 0: Install packages

**Files:**
- Modify: `package.json`

- [ ] Run install:
```bash
cd C:\Users\user\Desktop\lumiere-app
npm install iron-session sharp axios cheerio
npm install -D tsx @types/cheerio
```

- [ ] Verify — expected: no errors, packages appear in `node_modules/`

- [ ] Commit:
```bash
git add package.json package-lock.json
git commit -m "chore: install iron-session, sharp, axios, cheerio, tsx"
```

---

## Task 1: Add EnrichedInfo type to lib/products.ts

**Files:**
- Modify: `lib/products.ts`

- [ ] Add `EnrichedInfo` interface and update `Product`:

Replace the `Product` interface block in `lib/products.ts` with:
```typescript
export interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}

export interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  price: number;
  tags: string[];
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  image: string;
  moq: number;
  enrichedInfo?: EnrichedInfo;
}
```

- [ ] Verify build:
```bash
npm run build
```
Expected: no TypeScript errors

- [ ] Commit:
```bash
git add lib/products.ts
git commit -m "feat: add EnrichedInfo type to Product interface"
```

---

## Task 2: Replace category emojis with gold Lucide icons

**Files:**
- Modify: `components/home/CategoryGrid.tsx`

- [ ] Replace entire file content:
```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Droplets, Sparkles, FlaskConical, Scissors, Pill, Layers, Heart, Dna, Zap, Shield, Gem, Microscope, Brush, Target, Syringe, Activity, Leaf, PenLine, Globe, Package, type LucideIcon } from 'lucide-react';
import { categories } from '@/lib/products';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  fillers: Droplets,
  mesotherapy: Sparkles,
  'acne-treatment': FlaskConical,
  'hair-treatment': Scissors,
  'pharmacy-favourites': Pill,
  'topical-cosmetics': Layers,
  'intimate-care': Heart,
  'growth-factor-exosome': Dna,
  curenex: Zap,
  dermagen: Shield,
  gtm: Gem,
  equipment: Microscope,
  'salon-grade': Brush,
  lipolytics: Target,
  botulinum: Syringe,
  injections: Activity,
  anesthetics: Pill,
  'placental-therapy': Leaf,
  'nano-needle-cannula': PenLine,
  'imported-products': Globe,
};

export default function CategoryGrid() {
  const t = useTranslations('home.categories');
  const locale = useLocale();

  return (
    <section className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-4">
            {t('subtitle')}
          </p>
          <h2 className="section-title">{t('title')}</h2>
          <div className="gold-divider mx-auto mt-4" />
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Package;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  href={`/${locale}/catalogue/${cat.id}`}
                  className="group block bg-cream border border-gold/20 p-5 hover:border-gold hover:shadow-md transition-all duration-300 hover:-translate-y-1 rounded-sm"
                >
                  <div className="mb-3">
                    <Icon
                      size={22}
                      strokeWidth={1.5}
                      className="text-gold group-hover:text-gold-dark transition-colors duration-300"
                    />
                  </div>
                  <h3 className="text-xs font-semibold tracking-wide text-charcoal group-hover:text-gold transition-colors leading-tight">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-mist mt-1">
                    #{cat.range[0]}–{cat.range[1]}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold tracking-wider">View</span>
                    <ArrowRight size={12} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link
            href={`/${locale}/catalogue`}
            className="btn-secondary inline-flex items-center gap-2 text-xs"
          >
            {t('viewAll')}
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] Run build:
```bash
npm run build
```
Expected: no errors

- [ ] Commit:
```bash
git add components/home/CategoryGrid.tsx
git commit -m "feat: replace category emojis with gold Lucide icons"
```

---

## Task 3: Product detail page — sticky image + tab layout

**Files:**
- Create: `components/catalogue/ProductDetailTabs.tsx`
- Modify: `app/[locale]/product/[id]/page.tsx`

- [ ] Create `components/catalogue/ProductDetailTabs.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EnrichedInfo } from '@/lib/products';

const tabs = [
  { id: 'description', label: 'Description' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'howToUse', label: 'How to Use' },
  { id: 'ingredients', label: 'Ingredients' },
] as const;

type TabId = typeof tabs[number]['id'];

interface Props {
  description?: string;
  specification?: string;
  enrichedInfo?: EnrichedInfo;
}

export default function ProductDetailTabs({ description, specification, enrichedInfo }: Props) {
  const [active, setActive] = useState<TabId>('description');

  return (
    <div className="mt-12 border-t border-bone pt-8">
      <div className="flex gap-0 border-b border-bone mb-6 overflow-x-auto">
        {tabs.map(tab => {
          if (tab.id === 'benefits' && !enrichedInfo?.benefits?.length) return null;
          if (tab.id === 'howToUse' && !enrichedInfo?.protocol) return null;
          if (tab.id === 'ingredients' && !enrichedInfo?.ingredients) return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-colors border-b-2 -mb-px ${
                active === tab.id
                  ? 'border-gold text-gold'
                  : 'border-transparent text-mist hover:text-charcoal'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-charcoal leading-relaxed"
        >
          {active === 'description' && (
            <div className="space-y-4">
              {description && <p>{description}</p>}
              {specification && (
                <p className="text-mist text-xs">{specification}</p>
              )}
            </div>
          )}

          {active === 'benefits' && enrichedInfo?.benefits && (
            <ul className="space-y-2">
              {enrichedInfo.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">–</span>
                  <span>{b}</span>
                </li>
              ))}
              {enrichedInfo.treatmentAreas?.length && (
                <li className="mt-4 pt-4 border-t border-bone">
                  <span className="text-xs font-semibold tracking-wider uppercase text-mist">
                    Treatment Areas:
                  </span>{' '}
                  <span className="text-xs">{enrichedInfo.treatmentAreas.join(', ')}</span>
                </li>
              )}
              {enrichedInfo.duration && (
                <li>
                  <span className="text-xs font-semibold tracking-wider uppercase text-mist">
                    Duration:
                  </span>{' '}
                  <span className="text-xs">{enrichedInfo.duration}</span>
                </li>
              )}
            </ul>
          )}

          {active === 'howToUse' && enrichedInfo?.protocol && (
            <p>{enrichedInfo.protocol}</p>
          )}

          {active === 'ingredients' && enrichedInfo?.ingredients && (
            <p>{enrichedInfo.ingredients}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] Replace `app/[locale]/product/[id]/page.tsx` content:
```tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Layers } from 'lucide-react';
import { getProductById, getCategoryById, getProductsByCategory } from '@/lib/products';
import { getTranslations } from 'next-intl/server';
import ProductDetailClient from '@/components/catalogue/ProductDetailClient';
import ProductDetailTabs from '@/components/catalogue/ProductDetailTabs';
import ProductPrice from '@/components/catalogue/ProductPrice';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductImage from '@/components/catalogue/ProductImage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(parseInt(id));
  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.name,
    description: product.description || product.specification,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const product = getProductById(parseInt(id));
  if (!product) notFound();

  const t = await getTranslations({ locale, namespace: 'product' });
  const category = getCategoryById(product.categoryId);
  const related = getProductsByCategory(product.categoryId)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const hasEnriched = !!(
    product.enrichedInfo?.benefits?.length ||
    product.enrichedInfo?.protocol ||
    product.enrichedInfo?.ingredients
  );

  return (
    <div className="pt-24 min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-mist mb-8">
          <Link href={`/${locale}`} className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <Link href={`/${locale}/catalogue`} className="hover:text-gold transition-colors">Catalogue</Link>
          {category && (
            <>
              <span>/</span>
              <Link href={`/${locale}/catalogue/${category.id}`} className="hover:text-gold transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-charcoal font-medium line-clamp-1 max-w-xs">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Image — sticky on large screens */}
          <div className="lg:sticky lg:top-28">
            <div className="border border-bone aspect-square relative overflow-hidden">
              <ProductImage
                src={product.image}
                alt={product.name}
                productId={product.id}
                categoryId={product.categoryId}
                categoryName={category?.name}
                fill={false}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                {product.isNew && <span className="badge-new text-xs px-2 py-1">{t('tags.new')}</span>}
                {product.isSale && <span className="badge-sale text-xs px-2 py-1">{t('tags.sale')}</span>}
                {product.isBestSeller && <span className="badge-best text-xs px-2 py-1">{t('tags.bestSeller')}</span>}
              </div>
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2 text-xs text-mist mb-3">
              <span>#{product.id}</span>
              {category && (
                <>
                  <span>·</span>
                  <Link href={`/${locale}/catalogue/${product.categoryId}`} className="text-gold hover:underline">
                    {category.name}
                  </Link>
                </>
              )}
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-light text-charcoal mb-4">
              {product.name}
            </h1>
            <div className="gold-divider mb-6" />

            <ProductPrice price={product.price} moq={product.moq} moqLabel={t('units')} />

            {product.specification && (
              <div className="mb-6 p-4 bg-white border border-bone">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} className="text-gold" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-charcoal">
                    {t('specification')}
                  </span>
                </div>
                <p className="text-sm text-charcoal leading-relaxed">{product.specification}</p>
              </div>
            )}

            {!hasEnriched && product.description && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
                  {t('description')}
                </h3>
                <p className="text-sm text-charcoal leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-8">
              <div className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className="text-xs font-semibold text-charcoal">
                {product.inStock ? t('inStock') : t('outOfStock')}
              </span>
            </div>

            <ProductDetailClient product={product} />

            {product.tags.length > 0 && (
              <div className="mt-6 flex items-center gap-2">
                <Tag size={13} className="text-mist" />
                <div className="flex gap-2 flex-wrap">
                  {product.tags.map(tag => (
                    <span key={tag} className="text-xs text-mist border border-bone px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {hasEnriched && (
              <ProductDetailTabs
                description={product.description}
                specification={product.specification}
                enrichedInfo={product.enrichedInfo}
              />
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="section-title mb-8">{t('relatedProducts')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        <div className="mt-12">
          <Link
            href={`/${locale}/catalogue`}
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-mist hover:text-gold transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Run build:
```bash
npm run build
```
Expected: no errors

- [ ] Commit:
```bash
git add components/catalogue/ProductDetailTabs.tsx app/[locale]/product/[id]/page.tsx
git commit -m "feat: product detail sticky image + enrichedInfo tab layout"
```

---

## Task 4: Image download script

**Files:**
- Create: `scripts/fetch-product-images.ts`
- Modify: `package.json`

- [ ] Create `scripts/fetch-product-images.ts`:
```typescript
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const MISSING_FILE = path.join(process.cwd(), 'public', 'missing-images.txt');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface DdgImage { image: string; title: string; url: string; width: number; height: number; }

async function getVqd(query: string): Promise<string | null> {
  try {
    const res = await axios.get('https://duckduckgo.com/', {
      params: { q: query, iax: 'images', ia: 'images' },
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });
    const m = res.data.match(/vqd=['"]([^'"]+)['"]/i);
    return m?.[1] ?? null;
  } catch { return null; }
}

async function searchImages(query: string): Promise<DdgImage[]> {
  const vqd = await getVqd(query);
  if (!vqd) return [];
  await sleep(1000);
  try {
    const res = await axios.get('https://duckduckgo.com/i.js', {
      params: { q: query, o: 'json', l: 'us-en', s: '0', f: ',,,', vqd },
      headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' },
      timeout: 10000,
    });
    return res.data?.results ?? [];
  } catch { return []; }
}

function scoreImage(img: DdgImage, nameKeywords: string[]): number {
  const urlLower = img.image.toLowerCase();
  const titleLower = (img.title ?? '').toLowerCase();
  let score = 0;
  const matchedInUrl = nameKeywords.filter(k => urlLower.includes(k)).length;
  const matchedInTitle = nameKeywords.filter(k => titleLower.includes(k)).length;
  score += (matchedInUrl / nameKeywords.length) * 0.4;
  score += (matchedInTitle / nameKeywords.length) * 0.3;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(urlLower)) score += 0.1;
  if (/product|item|pack|bottle|vial|syringe/i.test(urlLower)) score += 0.2;
  if (/banner|advert|person|model|face|logo|icon/i.test(urlLower)) score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

async function downloadAndProcess(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': UA },
    });
    const buf = Buffer.from(res.data);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || meta.width < 400 || meta.height < 400) return false;
    let pipeline = sharp(buf);
    if (meta.width > 1600 || meta.height > 1600) {
      pipeline = pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
    return true;
  } catch { return false; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractKeywords(name: string): string[] {
  return name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Array<{ id: number; name: string; specification?: string; image: string }>;
  const missing: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const outputPath = path.join(OUTPUT_DIR, `product-${p.id}.webp`);

    if (fs.existsSync(outputPath)) {
      console.log(`${prefix}  ↷ ${p.name} (already exists, skipping)`);
      if (!p.image) data.products[i].image = `/images/products/product-${p.id}.webp`;
      continue;
    }

    const keywords = extractKeywords(p.name);
    const specWords = p.specification ? extractKeywords(p.specification).slice(0, 2) : [];
    const queries = [
      `${p.name} ${specWords.join(' ')} product`.trim(),
      `${p.name} Korean cosmetic aesthetic`,
      `${p.name} filler injection dermal`,
    ];

    let downloaded = false;
    for (const query of queries) {
      await sleep(2000);
      const images = await searchImages(query);
      for (const img of images.slice(0, 10)) {
        const score = scoreImage(img, keywords);
        if (score < 0.7) continue;
        await sleep(500);
        const ok = await downloadAndProcess(img.image, outputPath);
        if (ok) {
          const meta = await sharp(outputPath).metadata();
          console.log(`${prefix}  ✓ ${p.name} (score: ${score.toFixed(2)}, ${meta.width}×${meta.height})`);
          data.products[i].image = `/images/products/product-${p.id}.webp`;
          downloaded = true;
          break;
        }
      }
      if (downloaded) break;
    }

    if (!downloaded) {
      console.log(`${prefix}  ✗ ${p.name} (no match ≥ 0.7)`);
      missing.push(`#${p.id} ${p.name}`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  if (missing.length) {
    fs.writeFileSync(MISSING_FILE, missing.join('\n'), 'utf8');
    console.log(`\n${missing.length} products without images → public/missing-images.txt`);
  }
  console.log('\nDone. products.json updated.');
}

main().catch(console.error);
```

- [ ] Add script to `package.json` scripts section:
```json
"fetch-images": "tsx scripts/fetch-product-images.ts",
```

- [ ] Commit:
```bash
git add scripts/fetch-product-images.ts package.json
git commit -m "feat: add image auto-download script (DuckDuckGo + sharp)"
```

---

## Task 5: Description enrichment script

**Files:**
- Create: `scripts/enrich-product-descriptions.ts`
- Modify: `package.json`

- [ ] Create `scripts/enrich-product-descriptions.ts`:
```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}

async function ddgTextSearch(query: string): Promise<string[]> {
  try {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const urls: string[] = [];
    $('.result__url').each((_, el) => {
      const href = $(el).text().trim();
      if (href && !href.includes('duckduckgo') && urls.length < 3) {
        urls.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });
    return urls;
  } catch { return []; }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    $('script,style,nav,footer,header,aside').remove();
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
  } catch { return ''; }
}

function extractBenefits(text: string, name: string): string[] {
  const lines = text.split(/[.\n•·–—]/).map(l => l.trim()).filter(l => l.length > 20 && l.length < 200);
  const keywords = ['benefit', 'effect', 'result', 'treat', 'reduce', 'improve', 'restore', 'stimulate', 'correct', 'volume', 'hydrat', 'lift'];
  return lines
    .filter(l => keywords.some(k => l.toLowerCase().includes(k)))
    .slice(0, 5);
}

function extractTreatmentAreas(text: string): string[] {
  const areas = ['face', 'lips', 'nasolabial', 'cheeks', 'forehead', 'neck', 'hands', 'body', 'scalp', 'under-eye', 'jawline', 'temples', 'chin'];
  return areas.filter(a => text.toLowerCase().includes(a));
}

function extractDuration(text: string): string | undefined {
  const m = text.match(/(\d+[\-–]\d+\s*months?|\d+\s*months?|\bup to \d+\s*months?)/i);
  return m?.[0];
}

function extractIngredients(text: string): string | undefined {
  const m = text.match(/(hyaluronic acid|HA|lidocaine|PDRN|salmon DNA|polynucleotide|exosome|peptide|collagen|botulinum|abobotulinumtoxin)[^.]{0,200}/i);
  return m?.[0]?.trim();
}

function extractProtocol(text: string): string | undefined {
  const m = text.match(/(inject|administer|apply|use|dosage|protocol)[^.]{20,200}\./i);
  return m?.[0]?.trim();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const products = data.products as Array<{ id: number; name: string; enrichedInfo?: EnrichedInfo }>;
  let enriched = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;

    if (p.enrichedInfo) {
      console.log(`${prefix}  ↷ ${p.name} (already enriched, skipping)`);
      continue;
    }

    await sleep(2000);
    const urls = await ddgTextSearch(`${p.name} aesthetic cosmetic ingredients benefits`);
    let combined = '';

    for (const url of urls) {
      await sleep(800);
      combined += ' ' + await fetchPageText(url);
    }

    if (!combined.trim()) {
      console.log(`${prefix}  ✗ ${p.name} (no pages found)`);
      continue;
    }

    const info: EnrichedInfo = {};
    const benefits = extractBenefits(combined, p.name);
    if (benefits.length) info.benefits = benefits;
    const areas = extractTreatmentAreas(combined);
    if (areas.length) info.treatmentAreas = areas;
    const duration = extractDuration(combined);
    if (duration) info.duration = duration;
    const ingredients = extractIngredients(combined);
    if (ingredients) info.ingredients = ingredients;
    const protocol = extractProtocol(combined);
    if (protocol) info.protocol = protocol;

    if (Object.keys(info).length > 0) {
      data.products[i].enrichedInfo = info;
      enriched++;
      console.log(`${prefix}  ✓ ${p.name} (fields: ${Object.keys(info).join(', ')})`);
    } else {
      console.log(`${prefix}  ✗ ${p.name} (no structured info found)`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone. ${enriched} products enriched.`);
}

main().catch(console.error);
```

- [ ] Add to `package.json` scripts:
```json
"enrich-descriptions": "tsx scripts/enrich-product-descriptions.ts",
```

- [ ] Commit:
```bash
git add scripts/enrich-product-descriptions.ts package.json
git commit -m "feat: add description enrichment script (DDG + cheerio)"
```

---

## Task 6: Session config

**Files:**
- Create: `lib/session.ts`
- Modify: `.env.local`

- [ ] Create `lib/session.ts`:
```typescript
import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  cookieName: 'lumiere_admin_session',
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  },
};
```

- [ ] Update `.env.local` — replace its full contents:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_USERNAME=manzura
ADMIN_PASSWORD=Alanhon1_
SESSION_SECRET=0da159d8360076fbc3ffff05a5c174478b5523aa322121557d95aad3a86e2dd7
```

- [ ] Commit:
```bash
git add lib/session.ts
git commit -m "feat: add iron-session config"
```
Note: do NOT git add `.env.local` — it's already in `.gitignore`.

---

## Task 7: Middleware

**Files:**
- Create: `middleware.ts` (project root)

- [ ] Create `middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API admin protection (except auth endpoint itself)
  if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth')) {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (!session.loggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return res;
  }

  // Admin page protection
  if (pathname.startsWith('/manzura') && pathname !== '/manzura/login') {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (!session.loggedIn) {
      return NextResponse.redirect(new URL('/manzura/login', req.url));
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/manzura/:path*',
    '/api/admin/:path*',
  ],
};
```

- [ ] Run build to verify:
```bash
npm run build
```
Expected: no errors

- [ ] Commit:
```bash
git add middleware.ts
git commit -m "feat: add middleware for admin route protection (iron-session)"
```

---

## Task 8: Auth API routes

**Files:**
- Modify: `app/api/admin/auth/route.ts`
- Create: `app/api/admin/logout/route.ts`

- [ ] Replace `app/api/admin/auth/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const validUser = process.env.ADMIN_USERNAME ?? 'manzura';
  const validPass = process.env.ADMIN_PASSWORD ?? 'changeme123';

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.loggedIn = true;
  session.username = username;
  await session.save();
  return res;
}
```

- [ ] Create `app/api/admin/logout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  return res;
}
```

- [ ] Delete old admin files:
```bash
# Windows PowerShell
Remove-Item "app\[locale]\admin" -Recurse -Force
Remove-Item "components\admin\AdminClient.tsx" -Force
```

- [ ] Run build:
```bash
npm run build
```
Expected: no errors

- [ ] Commit:
```bash
git add app/api/admin/auth/route.ts app/api/admin/logout/route.ts
git commit -m "feat: replace auth route with iron-session login/logout"
```

---

## Task 9: Admin layout + login page

**Files:**
- Create: `app/(admin)/manzura/layout.tsx`
- Create: `app/(admin)/manzura/login/page.tsx`

- [ ] Create `app/(admin)/manzura/layout.tsx`:
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Lumière Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans">
      {children}
    </div>
  );
}
```

- [ ] Create `app/(admin)/manzura/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/manzura');
        router.refresh();
      } else {
        setError('Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm bg-white border border-gold/30 p-10 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-light text-charcoal tracking-wide">
            Lumière Admin
          </h1>
          <div className="gold-divider mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="w-full border border-bone px-4 py-3 text-sm outline-none focus:border-gold transition-colors bg-cream"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-bone px-4 py-3 text-sm outline-none focus:border-gold transition-colors bg-cream"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center animate-in fade-in duration-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full mt-2 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] Run build:
```bash
npm run build
```
Expected: no errors, `/manzura/login` route exists

- [ ] Commit:
```bash
git add "app/(admin)"
git commit -m "feat: admin layout and login page (/manzura/login)"
```

---

## Task 10: Admin dashboard

**Files:**
- Create: `app/(admin)/manzura/page.tsx`
- Create: `components/admin/DashboardClient.tsx`

- [ ] Create `components/admin/DashboardClient.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Grid3X3, ImageOff, Clock, Plus, Download, LogOut } from 'lucide-react';
import type { Product } from '@/lib/products';

interface BackupFile { name: string; size: number; created: string; }

interface Props {
  totalProducts: number;
  totalCategories: number;
  noImageCount: number;
  lastModified: string;
  recentProducts: Pick<Product, 'id' | 'name' | 'categoryId'>[];
  backups: BackupFile[];
}

export default function DashboardClient({ totalProducts, totalCategories, noImageCount, lastModified, recentProducts, backups }: Props) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/manzura/login');
    router.refresh();
  }

  async function handleRestore(filename: string) {
    if (!confirm(`Restore backup "${filename}"? Current data will be overwritten.`)) return;
    setRestoring(filename);
    try {
      await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      router.refresh();
    } finally {
      setRestoring(null);
    }
  }

  const stats = [
    { label: 'Total Products', value: totalProducts, icon: Package },
    { label: 'Categories', value: totalCategories, icon: Grid3X3 },
    { label: 'No Image', value: noImageCount, icon: ImageOff },
    { label: 'Last Edit', value: lastModified, icon: Clock, isText: true },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Dashboard</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">Lumière Admin Panel</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-mist hover:text-charcoal border border-bone px-4 py-2 transition-colors">
          <LogOut size={13} />
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-bone p-5">
            <s.icon size={18} className="text-gold mb-3" strokeWidth={1.5} />
            <div className={`font-display font-light text-charcoal mb-1 ${s.isText ? 'text-lg' : 'text-3xl'}`}>
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-mist">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/manzura/products/new" className="btn-gold text-xs flex items-center gap-2">
          <Plus size={14} />
          New Product
        </Link>
        <Link href="/manzura/products?filter=no-image" className="btn-secondary text-xs flex items-center gap-2">
          <ImageOff size={14} />
          Missing Images ({noImageCount})
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent */}
        <div className="bg-white border border-bone p-6">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-4">Recent Products</h2>
          <div className="space-y-2">
            {recentProducts.map(p => (
              <Link key={p.id} href={`/manzura/products/${p.id}`}
                className="flex items-center justify-between py-2 border-b border-bone/50 hover:text-gold transition-colors text-sm">
                <span className="text-mist text-xs">#{p.id}</span>
                <span className="flex-1 px-3 truncate">{p.name}</span>
                <span className="text-xs text-mist">{p.categoryId}</span>
              </Link>
            ))}
          </div>
          <Link href="/manzura/products" className="text-xs text-gold hover:underline mt-4 block">
            View all products →
          </Link>
        </div>

        {/* Backups */}
        <div className="bg-white border border-bone p-6">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-4">Backups</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {backups.length === 0 && <p className="text-xs text-mist">No backups yet</p>}
            {backups.map(b => (
              <div key={b.name} className="flex items-center justify-between text-xs py-1.5 border-b border-bone/50">
                <span className="text-mist truncate mr-2">{b.created}</span>
                <span className="text-mist mr-auto">{(b.size / 1024).toFixed(0)}KB</span>
                <button
                  onClick={() => handleRestore(b.name)}
                  disabled={restoring === b.name}
                  className="text-gold hover:underline disabled:opacity-50 ml-3"
                >
                  {restoring === b.name ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Create `app/(admin)/manzura/page.tsx`:
```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import fs from 'fs';
import path from 'path';
import { sessionOptions, type SessionData } from '@/lib/session';
import DashboardClient from '@/components/admin/DashboardClient';
import { products, categories } from '@/lib/products';

export default async function DashboardPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const backupDir = path.join(process.cwd(), 'data', 'backups');
  let backups: { name: string; size: number; created: string }[] = [];
  if (fs.existsSync(backupDir)) {
    backups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, created: stat.mtime.toLocaleString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 10);
  }

  const noImageCount = products.filter(p => !p.image).length;
  const recent = products.slice(-5).reverse();
  const lastModified = backups[0]?.created ?? 'Never';

  return (
    <DashboardClient
      totalProducts={products.length}
      totalCategories={categories.length}
      noImageCount={noImageCount}
      lastModified={lastModified}
      recentProducts={recent}
      backups={backups}
    />
  );
}
```

- [ ] Create `data/backups/.gitkeep`:
```bash
mkdir -p data/backups && touch data/backups/.gitkeep
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add "app/(admin)/manzura/page.tsx" components/admin/DashboardClient.tsx data/backups/.gitkeep
git commit -m "feat: admin dashboard with stats, recent products, and backups"
```

---

## Task 11: Admin products list

**Files:**
- Create: `app/(admin)/manzura/products/page.tsx`
- Create: `components/admin/ProductsClient.tsx`

- [ ] Create `components/admin/ProductsClient.tsx`:
```tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, X, Edit2, Trash2 } from 'lucide-react';
import type { Product } from '@/lib/products';
import type { Category } from '@/lib/products';

interface Props {
  products: Product[];
  categories: Category[];
  initialFilter?: string;
}

const PAGE_SIZE = 50;

export default function ProductsClient({ products, categories, initialFilter }: Props) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [imgFilter, setImgFilter] = useState(initialFilter === 'no-image' ? 'no-image' : '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q) || p.categoryId.includes(q));
    }
    if (catFilter) list = list.filter(p => p.categoryId === catFilter);
    if (imgFilter === 'no-image') list = list.filter(p => !p.image);
    if (imgFilter === 'has-image') list = list.filter(p => !!p.image);
    return list;
  }, [products, search, catFilter, imgFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleDelete(id: number) {
    if (!confirm(`Delete product #${id}?`)) return;
    setDeleting(id);
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    setDeleting(null);
    window.location.reload();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Products</h1>
        <div className="flex gap-3">
          <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
          <Link href="/manzura/products/new" className="btn-gold text-xs">+ New Product</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 border border-bone bg-white px-3 py-2 flex-1 min-w-48">
          <Search size={13} className="text-mist" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, ID, category..."
            className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
          />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-mist" /></button>}
        </div>
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={imgFilter}
          onChange={e => { setImgFilter(e.target.value); setPage(1); }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Images</option>
          <option value="has-image">Has Image</option>
          <option value="no-image">No Image</option>
        </select>
      </div>

      <p className="text-xs text-mist mb-3">Showing {filtered.length} of {products.length} products</p>

      <div className="bg-white border border-bone overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bone bg-cream">
                <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(paged.map(p => p.id)) : new Set())} /></th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-12">#</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-10">Img</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Name</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Price</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Status</th>
                <th className="text-right px-4 py-3 font-semibold tracking-wider text-mist uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(product => (
                <tr key={product.id} className="border-b border-bone hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelect(product.id)} /></td>
                  <td className="px-4 py-3 text-mist">{product.id}</td>
                  <td className="px-4 py-3">
                    {product.image
                      ? <img src={product.image} alt="" className="w-8 h-8 object-contain border border-bone" />
                      : <div className="w-8 h-8 bg-cream border border-bone flex items-center justify-center text-[8px] text-mist">—</div>
                    }
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal max-w-xs">
                    <span className="line-clamp-1">{product.name}</span>
                  </td>
                  <td className="px-4 py-3 text-mist hidden md:table-cell">{product.categoryId}</td>
                  <td className="px-4 py-3 font-semibold text-charcoal">{product.price > 0 ? `$${product.price}` : 'POA'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 border ${product.inStock ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
                      {product.inStock ? 'In Stock' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/manzura/products/${product.id}`} className="p-1.5 text-mist hover:text-gold border border-transparent hover:border-gold transition-colors">
                        <Edit2 size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleting === product.id}
                        className="p-1.5 text-mist hover:text-red-500 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40">←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} className={`px-3 py-1.5 border text-xs ${n === page ? 'border-gold text-gold' : 'border-bone text-mist'}`}>{n}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `app/(admin)/manzura/products/page.tsx`:
```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { products, categories } from '@/lib/products';
import ProductsClient from '@/components/admin/ProductsClient';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { filter } = await searchParams;
  return <ProductsClient products={products} categories={categories} initialFilter={filter} />;
}
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add "app/(admin)/manzura/products/page.tsx" components/admin/ProductsClient.tsx
git commit -m "feat: admin products list with search, filter, pagination"
```

---

## Task 12: Admin product edit page

**Files:**
- Create: `components/admin/ProductEditClient.tsx`
- Create: `app/(admin)/manzura/products/[id]/page.tsx`
- Create: `app/(admin)/manzura/products/new/page.tsx`

- [ ] Create `components/admin/ProductEditClient.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Product, EnrichedInfo } from '@/lib/products';
import type { Category } from '@/lib/products';

interface Props {
  product?: Product;
  categories: Category[];
  isNew?: boolean;
}

export default function ProductEditClient({ product, categories, isNew }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    name: '', specification: '', description: '', price: 0, moq: 1,
    categoryId: categories[0]?.id ?? '', tags: [], isNew: false,
    isSale: false, isBestSeller: false, inStock: true, image: '',
  });
  const [enriched, setEnriched] = useState<EnrichedInfo>(product?.enrichedInfo ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'enriched'>('basic');

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  }

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, enrichedInfo: Object.keys(enriched).length ? enriched : undefined };
      if (isNew) {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setIsDirty(false);
        router.push(`/manzura/products/${data.product.id}`);
      } else {
        await fetch(`/api/admin/products/${product!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        setIsDirty(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product || !confirm(`Delete #${product.id} ${product.name}?`)) return;
    setDeleting(true);
    await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
    router.push('/manzura/products');
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/admin/upload-image?id=${product.id}`, { method: 'POST', body: fd });
    const data = await res.json();
    update('image', data.path);
    setUploading(false);
  }

  const tagsStr = (form.tags ?? []).join(', ');

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/manzura/products" className="text-mist hover:text-gold transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-3xl font-light text-charcoal">
            {isNew ? 'New Product' : `#${product?.id} ${product?.name}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-4 py-2 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} className="inline mr-1" />
              Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-gold text-xs flex items-center gap-2 disabled:opacity-60">
            <Save size={13} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image */}
        {!isNew && (
          <div>
            <div className="border border-bone bg-white aspect-square flex items-center justify-center mb-3 overflow-hidden">
              {form.image
                ? <img src={form.image} alt={form.name} className="w-full h-full object-contain" />
                : <div className="text-mist text-xs">No image</div>
              }
            </div>
            <label className="btn-secondary w-full text-xs flex items-center justify-center gap-2 cursor-pointer">
              <Upload size={13} />
              {uploading ? 'Uploading…' : 'Replace Image'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        )}

        {/* Form */}
        <div className={isNew ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="flex gap-0 border-b border-bone mb-6">
            {(['basic', 'enriched'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase capitalize border-b-2 -mb-px transition-colors ${
                  activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-mist hover:text-charcoal'
                }`}>
                {tab === 'basic' ? 'Basic Info' : 'Enriched Info'}
              </button>
            ))}
          </div>

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <Field label="Name">
                <input value={form.name ?? ''} onChange={e => update('name', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price ($)">
                  <input type="number" step="0.01" value={form.price ?? 0} onChange={e => update('price', parseFloat(e.target.value))}
                    className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
                </Field>
                <Field label="MOQ (units)">
                  <input type="number" value={form.moq ?? 1} onChange={e => update('moq', parseInt(e.target.value))}
                    className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
                </Field>
              </div>
              <Field label="Category">
                <select value={form.categoryId ?? ''} onChange={e => update('categoryId', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Specification">
                <input value={form.specification ?? ''} onChange={e => update('specification', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Description">
                <textarea rows={4} value={form.description ?? ''} onChange={e => update('description', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
              <Field label="Tags (comma-separated)">
                <input value={tagsStr} onChange={e => update('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {(['isNew', 'isSale', 'isBestSeller', 'inStock'] as const).map(key => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form[key]} onChange={e => update(key, e.target.checked as any)}
                      className="accent-gold" />
                    <span className="text-xs capitalize">{key.replace('is', '').replace('Best', ' Best ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'enriched' && (
            <div className="space-y-4">
              <Field label="Benefits (one per line)">
                <textarea rows={5} value={(enriched.benefits ?? []).join('\n')}
                  onChange={e => { setEnriched(r => ({ ...r, benefits: e.target.value.split('\n').filter(Boolean) })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
              <Field label="Treatment Areas (comma-separated)">
                <input value={(enriched.treatmentAreas ?? []).join(', ')}
                  onChange={e => { setEnriched(r => ({ ...r, treatmentAreas: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Ingredients">
                <input value={enriched.ingredients ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, ingredients: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Duration">
                <input value={enriched.duration ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, duration: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Protocol / How to Use">
                <textarea rows={4} value={enriched.protocol ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, protocol: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-mist mb-1.5">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] Create `app/(admin)/manzura/products/[id]/page.tsx`:
```tsx
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getProductById, categories } from '@/lib/products';
import ProductEditClient from '@/components/admin/ProductEditClient';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const { id } = await params;
  const product = getProductById(parseInt(id));
  if (!product) notFound();
  return <ProductEditClient product={product} categories={categories} />;
}
```

- [ ] Create `app/(admin)/manzura/products/new/page.tsx`:
```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { categories } from '@/lib/products';
import ProductEditClient from '@/components/admin/ProductEditClient';

export default async function NewProductPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  return <ProductEditClient categories={categories} isNew />;
}
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add components/admin/ProductEditClient.tsx "app/(admin)/manzura/products/[id]/page.tsx" "app/(admin)/manzura/products/new/page.tsx"
git commit -m "feat: admin product edit and new product pages"
```

---

## Task 13: Admin categories + settings pages

**Files:**
- Create: `app/(admin)/manzura/categories/page.tsx`
- Create: `app/(admin)/manzura/settings/page.tsx`

- [ ] Create `app/(admin)/manzura/categories/page.tsx`:
```tsx
'use client';

// Note: this is a simple client page; categories edits are done inline
import { useState } from 'react';
import Link from 'next/link';
import { categories as initialCategories } from '@/lib/products';

export default function CategoriesPage() {
  const [cats, setCats] = useState(initialCategories);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(id: string, name: string) {
    setSaving(id);
    await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    setSaving(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Categories</h1>
        <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
      </div>
      <div className="bg-white border border-bone">
        {cats.map(cat => (
          <CategoryRow key={cat.id} cat={cat} saving={saving === cat.id} onSave={name => handleSave(cat.id, name)} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ cat, saving, onSave }: { cat: { id: string; name: string; range: [number, number] }; saving: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(cat.name);
  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-bone last:border-0">
      <span className="text-xs text-mist w-32 shrink-0">{cat.id}</span>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 border border-bone px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      <span className="text-xs text-mist w-20 text-right">#{cat.range[0]}–{cat.range[1]}</span>
      <button
        onClick={() => onSave(name)}
        disabled={saving || name === cat.name}
        className="btn-gold text-[10px] px-3 py-1.5 disabled:opacity-40"
      >
        {saving ? '…' : 'Save'}
      </button>
    </div>
  );
}
```

- [ ] Create `app/(admin)/manzura/settings/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';

export default function SettingsPage() {
  const [form, setForm] = useState({
    email: siteConfig.contact.email,
    phone: siteConfig.contact.phone,
    whatsapp: siteConfig.contact.whatsapp,
    telegram: siteConfig.contact.telegram,
    waLink: siteConfig.social.whatsapp,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Settings</h1>
        <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
      </div>
      <div className="bg-white border border-bone p-6 space-y-5">
        {[
          { key: 'email', label: 'Contact Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'whatsapp', label: 'WhatsApp Number' },
          { key: 'telegram', label: 'Telegram Handle' },
          { key: 'waLink', label: 'WhatsApp Link (wa.me/...)' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-mist mb-1.5">{f.label}</label>
            <input
              value={form[f.key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
        ))}
        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-gold text-xs disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-green-600">Saved! Redeploy to apply.</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add "app/(admin)/manzura/categories/page.tsx" "app/(admin)/manzura/settings/page.tsx"
git commit -m "feat: admin categories and settings pages"
```

---

## Task 14: Admin API — products POST + backup system

**Files:**
- Modify: `app/api/admin/products/route.ts`
- Modify: `app/api/admin/products/[id]/route.ts`
- Create: `app/api/admin/backup/route.ts`
- Create: `lib/backup.ts`

- [ ] Create `lib/backup.ts`:
```typescript
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 30;

export function createBackup(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${timestamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  files.slice(MAX_BACKUPS).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}

export function readData(): { products: any[]; categories: any[] } {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

export function writeData(data: any): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
```

- [ ] Replace `app/api/admin/products/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function GET() {
  const data = readData();
  return NextResponse.json({ products: data.products, categories: data.categories });
}

export async function POST(req: Request) {
  const updates = await req.json();
  const data = readData();
  const maxId = Math.max(0, ...data.products.map((p: any) => p.id));
  const newId = maxId + 1;
  const newProduct = {
    id: newId,
    name: '',
    categoryId: data.categories[0]?.id ?? '',
    specification: '',
    description: '',
    price: 0,
    moq: 1,
    tags: [],
    isNew: false,
    isSale: false,
    isBestSeller: false,
    inStock: true,
    image: '',
    ...updates,
    id: newId,
  };
  createBackup();
  data.products.push(newProduct);
  writeData(data);
  return NextResponse.json({ ok: true, product: newProduct });
}
```

- [ ] Replace `app/api/admin/products/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await req.json();
  const data = readData();
  const idx = data.products.findIndex((p: any) => p.id === parseInt(id));
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  data.products[idx] = { ...data.products[idx], ...updates };
  writeData(data);
  return NextResponse.json({ ok: true, product: data.products[idx] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = readData();
  createBackup();
  data.products = data.products.filter((p: any) => p.id !== parseInt(id));
  writeData(data);
  return NextResponse.json({ ok: true });
}
```

- [ ] Create `app/api/admin/backup/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createBackup, writeData } from '@/lib/backup';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');

export async function GET() {
  if (!fs.existsSync(BACKUP_DIR)) return NextResponse.json({ backups: [] });
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stat.size, created: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
  return NextResponse.json({ backups });
}

export async function POST(req: NextRequest) {
  const { filename } = await req.json();
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  fs.copyFileSync(src, DATA_FILE);
  return NextResponse.json({ ok: true });
}
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add lib/backup.ts app/api/admin/products/route.ts "app/api/admin/products/[id]/route.ts" app/api/admin/backup/route.ts
git commit -m "feat: admin products API with POST + automatic backup system"
```

---

## Task 15: Admin API — upload image, categories, settings

**Files:**
- Create: `app/api/admin/upload-image/route.ts`
- Create: `app/api/admin/categories/route.ts`
- Create: `app/api/admin/settings/route.ts`

- [ ] Create `app/api/admin/upload-image/route.ts`:
```typescript
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
```

- [ ] Create `app/api/admin/categories/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();
  const data = readData();
  const idx = data.categories.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  createBackup();
  data.categories[idx].name = name;
  writeData(data);
  return NextResponse.json({ ok: true });
}
```

- [ ] Create `app/api/admin/settings/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'lib', 'site-config.ts');

export async function PATCH(req: NextRequest) {
  const updates = await req.json();
  let src = fs.readFileSync(CONFIG_FILE, 'utf8');

  const replacements: Record<string, string> = {
    email: `email: "${updates.email}"`,
    phone: `phone: "${updates.phone}"`,
    whatsapp: `whatsapp: "${updates.whatsapp}"`,
    telegram: `telegram: "${updates.telegram}"`,
  };

  for (const [field, replacement] of Object.entries(replacements)) {
    src = src.replace(new RegExp(`${field}: "[^"]*"`), replacement);
  }
  if (updates.waLink) {
    src = src.replace(/whatsapp: "https:\/\/wa\.me\/[^"]*"/, `whatsapp: "${updates.waLink}"`);
  }

  fs.writeFileSync(CONFIG_FILE, src, 'utf8');
  return NextResponse.json({ ok: true });
}
```

- [ ] Run build:
```bash
npm run build
```

- [ ] Commit:
```bash
git add app/api/admin/upload-image/route.ts app/api/admin/categories/route.ts app/api/admin/settings/route.ts
git commit -m "feat: admin upload-image, categories, settings API routes"
```

---

## Task 16: robots.txt, README, HOW-TO-MANAGE.md

**Files:**
- Create: `public/robots.txt`
- Modify: `README.md`
- Create: `HOW-TO-MANAGE.md`

- [ ] Create `public/robots.txt`:
```
User-agent: *
Allow: /

Disallow: /manzura
Disallow: /api/admin/
```

- [ ] Update `README.md` — append at the end:
```markdown

## Admin Panel

Local admin panel: http://localhost:3000/manzura  
Login: `manzura` / (see .env.local)

## Scripts

```bash
# Download product images automatically (DuckDuckGo, no API key needed)
npm run fetch-images

# Enrich product descriptions from the web
npm run enrich-descriptions
```

After running scripts locally, commit the updated `data/products.json` and `public/images/` then push to GitHub — Vercel redeploys automatically.
```

- [ ] Create `HOW-TO-MANAGE.md` (Korean instructions for mom):
```markdown
# Lumière 사이트 관리 방법

## 관리자 패널 접속

1. 터미널에서 `npm run dev` 실행 (개발 서버 시작)
2. 브라우저에서 http://localhost:3000/manzura 접속
3. 아이디: `manzura`, 비밀번호: `.env.local` 파일 참고

## 상품 편집

1. 관리자 패널 → Products 메뉴
2. 검색창에 상품명 또는 번호 입력
3. 연필 아이콘(✏️) 클릭 → 편집 화면
4. 가격, 설명, 재고 수정 후 **Save** 버튼

## 상품 이미지 교체

1. 상품 편집 화면 → 이미지 영역
2. **Replace Image** 버튼 클릭
3. 컴퓨터에서 사진 파일 선택 (JPG, PNG 모두 가능)
4. 자동으로 최적화되어 업로드됨

## 새 상품 추가

1. Products 화면 우상단 **+ New Product** 클릭
2. 상품 정보 입력 후 Save

## 변경사항 사이트에 반영하기

관리자에서 저장해도 **인터넷 사이트는 자동으로 바뀌지 않습니다**.  
변경 후 아들/딸에게 연락 → GitHub에 올려달라고 하면 됩니다.  
Vercel이 자동으로 사이트를 업데이트합니다. (보통 2-3분 소요)

## 백업 복원

실수로 데이터를 잘못 수정한 경우:
1. 대시보드 화면 → Backups 섹션
2. 원하는 날짜의 백업 옆 **Restore** 클릭
3. 확인 후 복원됨
```

- [ ] Run final build:
```bash
npm run build
```
Expected: zero errors, zero warnings about missing pages

- [ ] Commit:
```bash
git add public/robots.txt README.md HOW-TO-MANAGE.md
git commit -m "docs: add robots.txt, README scripts section, HOW-TO-MANAGE Korean guide"
```

---

## Task 17: Final verification

- [ ] Start dev server:
```bash
npm run dev
```

- [ ] Manual test checklist:
  - [ ] http://localhost:3000/en — homepage shows gold Lucide icons in category grid (no emoji)
  - [ ] http://localhost:3000/en/product/1 — image is sticky on scroll, tabs appear if enrichedInfo exists
  - [ ] http://localhost:3000/manzura — redirects to /manzura/login
  - [ ] Login with username `manzura`, password `Alanhon1_` — succeeds, dashboard visible
  - [ ] Dashboard shows correct product/category counts
  - [ ] Products list — search and filter work
  - [ ] Edit a product → change name → Save → list reflects change
  - [ ] Upload image on product edit page → image previews immediately
  - [ ] Logout → redirects to login, /manzura redirects again
  - [ ] http://localhost:3000/robots.txt — shows Disallow: /manzura

- [ ] Run scripts test (optional, takes time):
```bash
# Test with just first 5 products to verify script works
# Edit scripts/fetch-product-images.ts temporarily: change `products.length` to `5` in the loop condition
npm run fetch-images
# Revert after testing
```

- [ ] Final build:
```bash
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] Final commit:
```bash
git add -A
git commit -m "chore: final build verification pass"
```
