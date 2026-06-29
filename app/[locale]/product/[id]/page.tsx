import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { Tag, Layers } from 'lucide-react';
import { getCategoryById, getLocalizedSpecification, categories } from '@/lib/products';
import { localePath } from '@/lib/i18n';
import { getProductById, getProductsByCategory, getProductVariants } from '@/lib/catalogue';
import { getProductOptionStock } from '@/lib/products/stock';
import { getTranslations } from 'next-intl/server';
import ProductDetailClient from '@/components/catalogue/ProductDetailClient';
import ProductStockStatus from '@/components/catalogue/ProductStockStatus';
import ProductDetailContent from '@/components/catalogue/ProductDetailContent';
import ProductPrice from '@/components/catalogue/ProductPrice';
import RelatedProducts from '@/components/catalogue/RelatedProducts';
import ProductGallery, { type GalleryItem } from '@/components/catalogue/ProductGallery';
import VariantSelector from '@/components/catalogue/VariantSelector';
import BackToCatalogueButton from '@/components/catalogue/BackToCatalogueButton';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(parseInt(id));
  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.name,
    description: product.description || product.specification,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const product = await getProductById(parseInt(id));
  if (!product) notFound();

  const t = await getTranslations({ locale, namespace: 'product' });
  const category = getCategoryById(product.categoryId);

  // Live per-option stock (page is force-dynamic, so this is fresh each load).
  // Drives the buy gate so a sold-out option is disabled BEFORE the customer
  // pays — payment is off-platform, so a paid-then-rejected order is real harm.
  const optionStockRows = await getProductOptionStock(product.id);
  const optionStock: Record<string, number> = Object.fromEntries(
    optionStockRows.map(r => [r.option, r.stock]),
  );

  // Related: score by shared brand prefix, price proximity, shared tags.
  function brandPrefix(name: string): string {
    const m = /^([A-Z][A-Z0-9-]{2,})\b/.exec(name);
    return m ? m[1].toLowerCase() : '';
  }
  const selfBrand = brandPrefix(product.name);
  const selfTags = new Set(product.tags ?? []);
  const related = (await getProductsByCategory(product.categoryId))
    .filter(p => p.id !== product.id && p.groupId !== product.groupId)
    .map(p => {
      let score = 0;
      const b = brandPrefix(p.name);
      if (selfBrand && b === selfBrand) score += 10;
      if (product.price > 0 && p.price > 0) {
        const ratio = p.price / product.price;
        if (ratio >= 0.5 && ratio <= 2) score += 3;
      }
      for (const t of (p.tags ?? [])) if (selfTags.has(t)) score += 2;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || a.p.id - b.p.id)
    .slice(0, 12)
    .map(x => x.p);

  const variants = product.groupId ? await getProductVariants(product.groupId) : [];

  const galleryItems: GalleryItem[] = product.groupId
    ? variants.flatMap(v => {
        const main: GalleryItem = {
          productId: v.id,
          href: localePath(locale, `/product/${v.id}`),
          src: v.image,
          alt: v.name,
          variantLabel: v.variantLabel,
        };
        const extras: GalleryItem[] = (v.images ?? []).map(img => ({
          productId: v.id,
          href: localePath(locale, `/product/${v.id}`),
          src: img,
          alt: v.name,
          variantLabel: v.variantLabel,
        }));
        return [main, ...extras];
      }).filter(it => it.src)
    : [
        {
          productId: product.id,
          href: localePath(locale, `/product/${product.id}`),
          src: product.image,
          alt: product.name,
        },
        ...(product.images ?? []).map(img => ({
          productId: product.id,
          href: localePath(locale, `/product/${product.id}`),
          src: img,
          alt: product.name,
        } as GalleryItem)),
      ].filter(it => it.src);

  const initialActiveIndex = Math.max(
    0,
    galleryItems.findIndex(it => it.productId === product.id && it.src === product.image)
  );

  const categoriesById: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.id, c.name])
  );

  return (
    <div className="pt-24 min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-6 md:py-12">
        <BackToCatalogueButton locale={locale} categoriesById={categoriesById} />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-mist mb-8">
          <Link href={localePath(locale)} className="hidden sm:inline hover:text-gold transition-colors">Home</Link>
          <span className="hidden sm:inline">/</span>
          <Link href={localePath(locale, '/catalogue')} className="hidden sm:inline hover:text-gold transition-colors">Catalogue</Link>
          {category && (
            <>
              <span className="hidden sm:inline">/</span>
              <Link href={localePath(locale, `/catalogue/${category.id}`)} className="hover:text-gold transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-charcoal font-medium truncate max-w-[60vw] sm:max-w-xs">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 items-start">
          {/* Image gallery — sticky on large screens */}
          <ProductGallery
            items={galleryItems}
            initialActiveIndex={initialActiveIndex}
            alt={product.name}
            productId={product.id}
            categoryId={product.categoryId}
            categoryName={category?.name}
            badges={
              <>
                {product.isNew && <span className="badge-new text-xs px-2 py-1">{t('tags.new')}</span>}
                {typeof product.originalPrice === 'number' && product.originalPrice > product.price && product.price > 0 && (
                  <span className="badge-discount text-xs px-2 py-1">−{Math.round((product.originalPrice - product.price) / product.originalPrice * 100)}%</span>
                )}
                {product.isBestSeller && <span className="badge-best text-xs px-2 py-1">{t('tags.bestSeller')}</span>}
              </>
            }
          />

          {/* Info */}
          <div>
            <div className="flex items-center gap-2 text-xs text-mist mb-3">
              <span>#{product.id}</span>
              {category && (
                <>
                  <span>·</span>
                  <Link href={localePath(locale, `/catalogue/${product.categoryId}`)} className="text-gold hover:underline">
                    {category.name}
                  </Link>
                </>
              )}
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-light text-charcoal mb-4">
              {product.name}
            </h1>
            <div className="gold-divider mb-6" />

            <VariantSelector currentProduct={product} variants={variants} />
            <ProductPrice price={product.price} originalPrice={product.originalPrice} moq={product.moq} moqLabel={t('units')} />

            <div className="mt-6 mb-8">
              <ProductDetailClient product={product} optionStock={optionStock} />
            </div>

            {product.specification && (
              <div className="mb-6 p-4 bg-white border border-bone rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} className="text-gold" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-charcoal">
                    {t('specification')}
                  </span>
                </div>
                <p className="text-sm text-charcoal leading-relaxed">{getLocalizedSpecification(product, locale)}</p>
              </div>
            )}

            <ProductStockStatus product={product} />

            {(() => {
              const tags = product.tags.filter(
                tag => tag && tag.toLowerCase() !== 'sale' && tag.toLowerCase() !== 'new',
              );
              if (tags.length === 0) return null;
              return (
                <div className="mt-6 flex items-start gap-2">
                  <Tag size={13} className="text-mist mt-1.5 shrink-0" />
                  <div className="flex gap-2 flex-wrap">
                    {tags.slice(0, 20).map(tag => (
                      <Link
                        key={tag}
                        href={localePath(locale, `/catalogue?q=${encodeURIComponent(tag)}`)}
                        className="tag-chip"
                        title={`Search "${tag}"`}
                      >
                        #{tag.replace(/\s+/g, '')}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

        <ProductDetailContent
          product={product}
          locale={locale}
          labels={{
            description: t('description'),
            indication: t('indication'),
            packaging: t('packaging'),
            protocol: t('protocol'),
          }}
        />

        <RelatedProducts products={related} title={t('relatedProducts')} />

      </div>
    </div>
  );
}
