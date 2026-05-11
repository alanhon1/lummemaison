'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Currency = 'USD' | 'RUB' | 'KRW';

interface CurrencyStore {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  RUB: 85,
  KRW: 1350,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  RUB: '₽',
  KRW: '₩',
};

export function formatPrice(priceUSD: number, currency: Currency): string {
  if (priceUSD <= 0) return 'POA';
  const converted = priceUSD * EXCHANGE_RATES[currency];
  const symbol = CURRENCY_SYMBOLS[currency];
  if (currency === 'RUB') {
    return `${Math.round(converted).toLocaleString('ru-RU')} ${symbol}`;
  }
  if (currency === 'KRW') {
    return `${symbol}${Math.round(converted).toLocaleString('ko-KR')}`;
  }
  return `${symbol}${converted.toFixed(2)}`;
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
