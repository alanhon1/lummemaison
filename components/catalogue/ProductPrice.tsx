'use client';

import { useCurrencyStore, formatPrice } from '@/lib/currency-store';

interface Props {
  price: number;
  moq: number;
  moqLabel: string;
}

export default function ProductPrice({ price, moq, moqLabel }: Props) {
  const { currency } = useCurrencyStore();
  return (
    <div className="mb-6">
      <div className="font-display text-4xl font-light text-charcoal">
        {formatPrice(price, currency)}
      </div>
      {moq > 1 && (
        <p className="text-xs text-mist mt-1">
          MOQ: {moq} {moqLabel}
        </p>
      )}
    </div>
  );
}
