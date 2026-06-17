'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { ShoppingBag, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useProductStock } from '@/lib/stock-store';
import { useCurrencyStore } from '@/lib/currency-store';
import { localePath } from '@/lib/i18n';
import { purchaseBlockReason, purchaseBlockLabel, type Product } from '@/lib/products';

export default function ProductDetailClient({ product }: { product: Product }) {
  const t = useTranslations('product');
  const tCat = useTranslations('catalogue');
  const { addItem } = useCartStore();
  const locale = useLocale();
  useCurrencyStore();
  const [added, setAdded] = useState(false);
  // Purchase is gated only by the admin's "Available for order" switch and the
  // "Not for sale" flag — NEVER by the real stock count (oversell/preorder is
  // allowed). A purchasable product whose real stock is 0 is a preorder.
  const blockReason = purchaseBlockReason(product);
  const cannotBuy = blockReason !== null;
  const blockLabel = blockReason ? purchaseBlockLabel(blockReason) : '';
  const stock = useProductStock(product.id);
  const isPreorder = !cannotBuy && stock === 0;

  const options = product.options ?? [];
  const [option, setOption] = useState(options[0] ?? '');
  const optionLabel = options.length > 0 && options.every(o => /mm$/i.test(o)) ? 'Length' : 'Option';

  function handleAddToCart() {
    if (cannotBuy) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
      ...(options.length > 0 ? { option: option || options[0] } : {}),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {options.length > 0 && (
        <div>
          <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-2">
            {optionLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            {options.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => setOption(o)}
                className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-sm border transition-colors ${
                  o === option
                    ? 'border-gold text-gold bg-gold/10'
                    : 'border-bone text-charcoal hover:border-gold'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={handleAddToCart}
        disabled={cannotBuy}
        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
          cannotBuy
            ? 'bg-charcoal text-cream cursor-not-allowed'
            : added
              ? 'bg-green-600 text-white border border-green-600'
              : 'btn-gold'
        }`}
      >
        {cannotBuy ? (
          <>{blockLabel}</>
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
      {isPreorder && (
        <p className="text-xs text-gold-dark">
          <span className="font-semibold uppercase tracking-widest">Preorder</span>
          {' '}— available to order now, ships once restocked (typically 2 weeks–2 months).
        </p>
      )}
    </div>
  );
}
