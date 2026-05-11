'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/lib/store';

export default function CartPageClient() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <ShoppingBag size={48} className="text-bone mx-auto mb-4" />
        <p className="font-display text-2xl font-light mb-3">{t('empty')}</p>
        <p className="text-sm text-mist mb-8">{t('emptyHint')}</p>
        <Link href={`/${locale}/catalogue`} className="btn-primary">
          {t('continueShopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Items */}
      <div className="lg:col-span-2 space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex gap-4 p-4 bg-white border border-bone">
            <div className="w-20 h-20 bg-cream flex-shrink-0 flex items-center justify-center">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag size={24} className="text-bone" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-charcoal line-clamp-2">{item.name}</h3>
              {item.specification && (
                <p className="text-xs text-mist mt-0.5 line-clamp-1">{item.specification}</p>
              )}
              <p className="text-base font-semibold text-gold mt-1">${item.price.toFixed(2)}</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-7 h-7 border border-bone flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                >
                  <Minus size={11} />
                </button>
                <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-7 h-7 border border-bone flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => removeItem(item.id)}
                className="text-mist hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
              <p className="text-sm font-semibold text-charcoal">
                ${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
        ))}

        <div className="flex justify-between pt-2">
          <Link
            href={`/${locale}/catalogue`}
            className="text-xs text-mist hover:text-gold transition-colors flex items-center gap-1"
          >
            ← {t('continueShopping')}
          </Link>
          <button
            onClick={clearCart}
            className="text-xs text-mist hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} />
            {t('clear')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white border border-bone p-6 h-fit">
        <h2 className="font-display text-xl font-light mb-6">Order Summary</h2>
        <div className="space-y-3 mb-6 pb-6 border-b border-bone">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-xs">
              <span className="text-mist line-clamp-1 flex-1 mr-2">
                {item.name} × {item.quantity}
              </span>
              <span className="font-semibold text-charcoal flex-shrink-0">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mb-8">
          <span className="text-sm font-semibold">{t('total')}</span>
          <span className="font-display text-2xl font-light">${totalPrice().toFixed(2)}</span>
        </div>
        <Link
          href={`/${locale}/checkout`}
          className="btn-primary w-full text-center flex items-center justify-center gap-2"
        >
          {t('checkout')}
          <ArrowRight size={14} />
        </Link>
        <p className="text-xs text-mist text-center mt-4">
          + Shipping calculated at checkout
        </p>
      </div>
    </div>
  );
}
