'use client';

import { useTranslations } from 'next-intl';
import type { Product } from '@/lib/products';

// Customer-facing availability. Stock is admin-only now (oversell lets every
// in-sale product be ordered), so we only surface the hard "not for sale" block.
export default function ProductStockStatus({ product }: { product: Product }) {
  const t = useTranslations('product');
  if (!product.notForSale) return null;
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-2 h-2 rounded-full bg-red-400" />
      <span className="text-xs font-semibold text-charcoal">{t('outOfStock')}</span>
    </div>
  );
}
