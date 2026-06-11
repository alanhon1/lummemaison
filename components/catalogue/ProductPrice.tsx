'use client';

import { useCurrencyStore, formatPrice } from '@/lib/currency-store';

interface Props {
  price: number;
  originalPrice?: number;
  moq: number;
  moqLabel: string;
}

export default function ProductPrice({ price, originalPrice, moq, moqLabel }: Props) {
  const { currency } = useCurrencyStore();
  const onSale = typeof originalPrice === 'number' && originalPrice > price && price > 0;
  const pct = onSale ? Math.round((originalPrice! - price) / originalPrice! * 100) : 0;
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="font-display text-4xl font-light text-charcoal">
          {formatPrice(price, currency)}
        </div>
        {onSale && (
          <>
            <span className="text-xl text-mist line-through">
              {formatPrice(originalPrice!, currency)}
            </span>
            <span className="text-xs font-semibold tracking-wide text-gold bg-gold/10 px-2 py-0.5 rounded">
              −{pct}%
            </span>
          </>
        )}
      </div>
      {moq > 1 && (
        <p className="text-xs text-mist mt-1">
          MOQ: {moq} {moqLabel}
        </p>
      )}
    </div>
  );
}
