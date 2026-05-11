'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingBag, MessageCircle, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';
import { siteConfig } from '@/lib/site-config';
import type { Product } from '@/lib/products';

export default function ProductDetailClient({ product }: { product: Product }) {
  const t = useTranslations('product');
  const tCat = useTranslations('catalogue');
  const { addItem } = useCartStore();
  const { currency } = useCurrencyStore();
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
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
        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
          added
            ? 'bg-green-600 text-white border border-green-600'
            : 'btn-primary'
        }`}
      >
        {added ? (
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
      <a
        href={`${siteConfig.social.whatsapp}?text=${encodeURIComponent(`Hi! I'm interested in: #${product.id} ${product.name}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-6 py-4 bg-[#25D366] text-white text-xs font-semibold tracking-[0.2em] uppercase hover:bg-[#20bd5a] transition-colors"
      >
        <MessageCircle size={16} />
        {t('contactForOrder')}
      </a>
    </div>
  );
}
