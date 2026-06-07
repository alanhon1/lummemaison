'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { ShoppingBag, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore } from '@/lib/currency-store';
import { useProductStock } from '@/lib/stock-store';
import { localePath } from '@/lib/i18n';
import type { Product } from '@/lib/products';

export default function ProductDetailClient({ product }: { product: Product }) {
  const t = useTranslations('product');
  const tCat = useTranslations('catalogue');
  const { addItem } = useCartStore();
  const locale = useLocale();
  useCurrencyStore();
  const [added, setAdded] = useState(false);
  const stock = useProductStock(product.id);
  const soldOut = stock === 0;

  function handleAddToCart() {
    if (soldOut) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={handleAddToCart}
        disabled={soldOut}
        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
          soldOut
            ? 'bg-charcoal text-cream cursor-not-allowed'
            : added
              ? 'bg-green-600 text-white border border-green-600'
              : 'btn-gold'
        }`}
      >
        {soldOut ? (
          <>{t('soldOut')}</>
        ) : added ? (
          <>
            <Check size={16} />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingBag size={16} />
            {tCat('addToCart')}
          </>
        )}
      </button>
      <Link
        href={localePath(locale, '/contact')}
        className="btn-secondary px-6 py-4 gap-2 flex items-center justify-center text-xs font-semibold tracking-[0.2em] uppercase"
      >
        {t('contactForOrder')}
      </Link>
    </div>
  );
}
