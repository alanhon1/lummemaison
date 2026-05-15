import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Layers } from 'lucide-react';
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants } from '@/lib/products';
import { getTranslations } from 'next-intl/server';
import ProductDetailClient from '@/components/catalogue/ProductDetailClient';
import ProductDetailTabs from '@/components/catalogue/ProductDetailTabs';
import ProductPrice from '@/components/catalogue/ProductPrice';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductGallery from '@/components/catalogue/ProductGallery';
import VariantSelector from '@/components/catalogue/VariantSelector';

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
    .filter(p => p.id !== product.id && !p.groupId)
    .slice(0, 4);

  const variants = product.groupId ? getProductVariants(product.groupId) : [];

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
          {/* Image gallery — sticky on large screens */}
          <ProductGallery
            mainImage={product.image}
            extraImages={product.images ?? []}
            alt={product.name}
            productId={product.id}
            categoryId={product.categoryId}
            categoryName={category?.name}
            badges={
              <>
                {product.isNew && <span className="badge-new text-xs px-2 py-1">{t('tags.new')}</span>}
                {product.isSale && <span className="badge-sale text-xs px-2 py-1">{t('tags.sale')}</span>}
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

            <VariantSelector currentProduct={product} variants={variants} />
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
