'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore, type CartItem } from '@/lib/store';

export interface ReorderItem {
  id: number;
  name: string;
  price: number;    // decimal USD
  image: string;
  specification: string;
  quantity: number;
  option?: string;
}

interface Props {
  items: ReorderItem[];
  locale: string;
  reorderLabel: string;
  confirmText: string;
  // Shown (with the skipped product names appended) when SOME items are no
  // longer purchasable; and when ALL of them are.
  skippedLabel: string;
  noneAvailableLabel: string;
}

export default function ReorderButton({
  items,
  locale,
  reorderLabel,
  confirmText,
  skippedLabel,
  noneAvailableLabel,
}: Props) {
  const router = useRouter();
  const { items: cartItems, clearCart, addItem } = useCartStore();
  const [busy, setBusy] = useState(false);

  async function handleReorder() {
    if (busy || items.length === 0) return;
    if (cartItems.length > 0 && !window.confirm(confirmText)) return;

    // Re-check live availability before re-adding. A product from a past order
    // may since have been flagged not-for-sale / out of stock — those must not
    // go back into the cart (the checkout guard would reject them anyway).
    setBusy(true);
    const ids = [...new Set(items.map(i => i.id))];
    const blocked = new Set<number>();
    try {
      const res = await fetch(`/api/products/availability?ids=${ids.join(',')}`);
      if (res.ok) {
        const data = (await res.json()) as Record<string, { notForSale?: boolean; outOfStock?: boolean }>;
        for (const id of ids) {
          const a = data[String(id)];
          if (a && (a.notForSale || a.outOfStock)) blocked.add(id);
        }
      }
      // A non-OK response falls through with an empty `blocked` set: we add
      // everything and let the cart/checkout guards catch any blocked line.
    } catch {
      // Network error — same fallback; never lose the reorder over a hiccup.
    } finally {
      setBusy(false);
    }

    const available = items.filter(i => !blocked.has(i.id));
    const skipped = items.filter(i => blocked.has(i.id));

    if (available.length === 0) {
      // Everything is blocked — leave the existing cart untouched.
      window.alert(noneAvailableLabel);
      return;
    }

    clearCart();
    for (const item of available) {
      const cartItem: Omit<CartItem, 'quantity'> = {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        specification: item.specification,
        ...(item.option ? { option: item.option } : {}),
      };
      // addItem increments qty by 1 each call; call once per quantity
      for (let i = 0; i < item.quantity; i++) {
        addItem(cartItem);
      }
    }

    if (skipped.length > 0) {
      const names = [...new Set(skipped.map(s => s.name))].join(', ');
      window.alert(`${skippedLabel}\n${names}`);
    }
    router.push(`/${locale}/cart`);
  }

  return (
    <button
      onClick={handleReorder}
      disabled={busy}
      className="btn-outline text-xs disabled:opacity-60"
    >
      {reorderLabel}
    </button>
  );
}
