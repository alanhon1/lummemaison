'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { ShoppingBag, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore } from '@/lib/currency-store';
import { localePath } from '@/lib/i18n';
import { purchaseBlockReason, purchaseBlockLabel, type Product } from '@/lib/products';
import RequestModal from './RequestModal';

export default function ProductDetailClient({
  product,
  optionStock,
}: {
  product: Product;
  // Live stock per purchase option (key '' = optionless). Server-provided so the
  // gate is correct before any payment. Missing key ⇒ treat as 0 (sold out).
  optionStock: Record<string, number>;
}) {
  const t = useTranslations('product');
  const tCat = useTranslations('catalogue');
  const { addItem } = useCartStore();
  const items = useCartStore(s => s.items);
  const locale = useLocale();
  useCurrencyStore();
  const [added, setAdded] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const options = product.options ?? [];
  const [option, setOption] = useState(options[0] ?? '');
  const optionLabel = options.length > 0 && options.every(o => /mm$/i.test(o)) ? 'Length' : 'Option';

  // Purchase is gated by: the "Not for sale" flag, the admin "Available for
  // order" switch (purchaseBlockReason), AND real stock of the SELECTED option —
  // a sold-out option can't be bought (the customer can "make a request" for it
  // instead so we can gauge demand before restocking).
  const blockReason = purchaseBlockReason(product);
  const selectedKey = options.length > 0 ? (option || options[0]) : '';
  const selectedStock = optionStock[selectedKey] ?? 0;
  const optionSoldOut = (o: string) => (optionStock[o] ?? 0) <= 0;
  const outOfStock = !blockReason && selectedStock <= 0;
  const cannotBuy = blockReason !== null || outOfStock;
  const blockLabel = blockReason ? purchaseBlockLabel(blockReason) : outOfStock ? 'Out of stock' : '';

  // How many of the SELECTED line are already in the cart, and whether that
  // already uses up the cap. selectedStock is the orderableCap (server-capped),
  // so a wonder/unknown/notForSale option is selectedStock === 0 ⇒ outOfStock.
  const inCart = items.find(
    i => i.id === product.id && (i.option ?? '') === selectedKey,
  )?.quantity ?? 0;
  const atCap = !cannotBuy && selectedStock > 0 && inCart >= selectedStock;
  // The admin per-order cap is the binding constraint when it equals the
  // orderableCap (i.e. real stock is not the tighter limit). Drives a
  // "Limited to N per order" message distinct from the low-stock one.
  const maxPerOrder = product.max_per_order ?? 0;
  const perOrderBinding = maxPerOrder > 0 && selectedStock === maxPerOrder;

  function handleAddToCart() {
    if (cannotBuy || atCap) return;
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
            {options.map(o => {
              const soldOut = optionSoldOut(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOption(o)}
                  title={soldOut ? 'Out of stock' : undefined}
                  className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-sm border transition-colors ${
                    o === option
                      ? 'border-gold text-gold bg-gold/10'
                      : 'border-bone text-charcoal hover:border-gold'
                  } ${soldOut ? 'line-through opacity-50' : ''}`}
                >
                  {o}{soldOut ? ' · Out' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={handleAddToCart}
        disabled={cannotBuy || atCap}
        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
          cannotBuy || atCap
            ? 'bg-charcoal text-cream cursor-not-allowed'
            : added
              ? 'bg-green-600 text-white border border-green-600'
              : 'btn-gold'
        }`}
      >
        {cannotBuy ? (
          <>{blockLabel}</>
        ) : atCap ? (
          <>Max in cart ({selectedStock})</>
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
      {atCap && perOrderBinding && !outOfStock && (
        <div className="rounded-md border border-bone bg-cream/60 p-3">
          <p className="text-xs text-charcoal">
            <span className="font-semibold">Limited to {maxPerOrder} per order</span> — that&apos;s all
            in your cart. You can place another order later.
          </p>
        </div>
      )}
      {(outOfStock || (atCap && !perOrderBinding)) && (
        <div className="rounded-md border border-bone bg-cream/60 p-3">
          <p className="text-xs text-charcoal mb-2">
            {outOfStock ? (
              <>
                <span className="font-semibold">Out of stock</span> — this item isn&apos;t available
                right now, please check back later.
              </>
            ) : (
              <>
                <span className="font-semibold">Only {selectedStock} in stock</span> — that&apos;s all
                in your cart. Need more? Make a request and we&apos;ll plan a restock.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="btn-secondary text-xs px-4 py-2 inline-flex items-center justify-center"
          >
            Make a request
          </button>
        </div>
      )}
      {requestOpen && (
        <RequestModal
          productId={product.id}
          productName={product.name}
          option={options.length > 0 ? (option || options[0]) : undefined}
          onClose={() => setRequestOpen(false)}
        />
      )}
    </div>
  );
}
