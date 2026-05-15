'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { Product } from '@/lib/products';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';

interface VariantSelectorProps {
  currentProduct: Product;
  variants: Product[];
}

export default function VariantSelector({ currentProduct, variants }: VariantSelectorProps) {
  const router = useRouter();
  const locale = useLocale();
  const { currency } = useCurrencyStore();

  if (variants.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = parseInt(e.target.value);
    if (!isNaN(id) && id !== currentProduct.id) {
      router.push(`/${locale}/product/${id}`);
    }
  }

  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold tracking-wider uppercase text-mist mb-2">
        Choose an option
      </label>
      <div className="relative">
        <select
          value={currentProduct.id}
          onChange={handleChange}
          className="w-full border border-bone px-4 py-3 text-sm text-charcoal bg-white outline-none hover:border-gold focus:border-gold transition-colors appearance-none cursor-pointer"
        >
          {variants.map(v => (
            <option key={v.id} value={v.id}>
              {v.variantLabel || v.name}
              {v.price !== currentProduct.price ? ` — ${formatPrice(v.price, currency)}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-mist"
        />
      </div>
    </div>
  );
}
