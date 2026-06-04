'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// USD is the only supported currency. The store + formatPrice are kept so that
// existing consumers (e.g. ProductPrice.tsx) work unchanged.
export type Currency = 'USD';

interface CurrencyStore {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
};

export function formatPrice(priceUSD: number, _currency: Currency = 'USD'): string {
  if (priceUSD <= 0) return 'POA';
  return `$${priceUSD.toFixed(2)}`;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
    }),
    { name: 'lumiere-currency' }
  )
);
