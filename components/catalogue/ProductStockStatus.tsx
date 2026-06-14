'use client';

import { useTranslations } from 'next-intl';
import { useProductStock } from '@/lib/stock-store';
import type { Product } from '@/lib/products';

// Real-time availability dot for the product page. Three states that mirror the
// buy button: notForSale is a hard block (red), stock 0 is still orderable as a
// backorder (amber), and anything else is in stock (green). While stock loads
// (`undefined`) it shows "In Stock", matching the button being enabled.
export default function ProductStockStatus({ product }: { product: Product }) {
  const t = useTranslations('product');
  const stock = useProductStock(product.id);
  const notForSale = !!product.notForSale;
  const backorder = !notForSale && stock === 0;
  const dot = notForSale ? 'bg-red-400' : backorder ? 'bg-amber-500' : 'bg-green-500';
  const label = notForSale ? t('outOfStock') : backorder ? t('backorder') : t('inStock');
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs font-semibold text-charcoal">{label}</span>
    </div>
  );
}
