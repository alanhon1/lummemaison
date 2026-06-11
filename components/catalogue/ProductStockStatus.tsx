'use client';

import { useTranslations } from 'next-intl';
import { useProductStock } from '@/lib/stock-store';
import type { Product } from '@/lib/products';

// Real-time availability dot for the product page. Mirrors the buy button's
// `cannotBuy` logic (stock 0 or not-for-sale) so the indicator never claims
// "In Stock" while the button is disabled. While stock loads (`undefined`),
// it shows "In Stock", matching the button being enabled during load.
export default function ProductStockStatus({ product }: { product: Product }) {
  const t = useTranslations('product');
  const stock = useProductStock(product.id);
  const unavailable = stock === 0 || !!product.notForSale;
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className={`w-2 h-2 rounded-full ${unavailable ? 'bg-red-400' : 'bg-green-500'}`} />
      <span className="text-xs font-semibold text-charcoal">
        {unavailable ? t('outOfStock') : t('inStock')}
      </span>
    </div>
  );
}
