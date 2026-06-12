'use client';

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
}

export default function ReorderButton({ items, locale, reorderLabel, confirmText }: Props) {
  const router = useRouter();
  const { items: cartItems, clearCart, addItem } = useCartStore();

  function handleReorder() {
    if (items.length === 0) return;
    if (cartItems.length > 0 && !window.confirm(confirmText)) return;
    clearCart();
    for (const item of items) {
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
    router.push(`/${locale}/cart`);
  }

  return (
    <button
      onClick={handleReorder}
      className="btn-outline text-xs"
    >
      {reorderLabel}
    </button>
  );
}
