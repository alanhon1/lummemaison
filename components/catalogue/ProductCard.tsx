'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';
import type { Product } from '@/lib/products';
import ProductImage from './ProductImage';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
}

export default function ProductCard({ product, layout = 'grid' }: ProductCardProps) {
  const t = useTranslations('catalogue');
  const tProduct = useTranslations('product');
  const locale = useLocale();
  const { addItem } = useCartStore();
  const { currency } = useCurrencyStore();

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
    });
  }

  if (layout === 'list') {
    return (
      <Link
        href={`/${locale}/product/${product.id}`}
        className="flex gap-4 p-4 bg-white border border-bone hover:border-gold transition-all duration-300 group"
      >
        <div className="w-20 h-20 flex-shrink-0 relative overflow-hidden">
          <ProductImage
            src={product.image}
            alt={product.name}
            productId={product.id}
            categoryId={product.categoryId}
            fill
            sizes="80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex gap-1.5 mb-1.5">
                {product.isNew && <span className="badge-new">{tProduct('tags.new')}</span>}
                {product.isSale && <span className="badge-sale">{tProduct('tags.sale')}</span>}
                {product.isBestSeller && <span className="badge-best">{tProduct('tags.bestSeller')}</span>}
              </div>
              <h3 className="text-sm font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight">
                #{product.id} {product.name}
              </h3>
              {product.specification && (
                <p className="text-xs text-mist mt-1 line-clamp-1">{product.specification}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="font-display text-lg font-light text-charcoal">
                {formatPrice(product.price, currency)}
              </div>
              {product.moq > 1 && (
                <div className="text-xs text-mist">MOQ: {product.moq}</div>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleAddToCart}
          className="self-center flex-shrink-0 w-9 h-9 border border-bone flex items-center justify-center hover:border-gold hover:text-gold text-charcoal transition-colors"
          aria-label={t('addToCart')}
        >
          <ShoppingBag size={16} />
        </button>
      </Link>
    );
  }

  return (
    <Link
      href={`/${locale}/product/${product.id}`}
      className="product-card group block"
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden">
        <ProductImage
          src={product.image}
          alt={product.name}
          productId={product.id}
          categoryId={product.categoryId}
          fill
          className="group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.isNew && <span className="badge-new">{tProduct('tags.new')}</span>}
          {product.isSale && <span className="badge-sale">{tProduct('tags.sale')}</span>}
          {product.isBestSeller && <span className="badge-best">{tProduct('tags.bestSeller')}</span>}
        </div>

        {/* Quick Add overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button
            onClick={handleAddToCart}
            className="w-full btn-gold text-[10px] py-2.5 flex items-center justify-center gap-2"
          >
            <ShoppingBag size={13} />
            {t('addToCart')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-mist mb-1">#{product.id}</p>
        <h3 className="text-xs font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-2">
          {product.name}
        </h3>
        {product.specification && (
          <p className="text-xs text-mist line-clamp-1 mb-3">{product.specification}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-display text-base font-light text-charcoal">
              {formatPrice(product.price, currency)}
            </span>
            {product.moq > 1 && (
              <span className="text-xs text-mist ml-1.5">MOQ:{product.moq}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
