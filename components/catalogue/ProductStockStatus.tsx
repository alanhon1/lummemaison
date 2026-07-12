'use client';

import { useTranslations } from 'next-intl';
import { purchaseBlockReason, type Product } from '@/lib/products';

// Customer-facing availability. The real stock count never blocks buying
// (oversell/preorder is allowed); we only surface the admin's hard blocks —
// "Not for sale" and "Available for order" switched off. Preorder labelling for
// purchasable, zero-stock products lives next to the buy button (ProductDetailClient).
export default function ProductStockStatus({ product }: { product: Product }) {
  const t = useTranslations('product');
  const reason = purchaseBlockReason(product);
  if (!reason) return null;
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-2 h-2 rounded-full bg-red-400" />
      <span className="text-xs font-semibold text-charcoal">{reason === 'notForSale' ? 'Sold out' : t('outOfStock')}</span>
    </div>
  );
}
