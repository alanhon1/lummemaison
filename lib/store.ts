'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  specification: string;
  // Chosen purchase option (e.g. needle length "6mm"), when the product offers
  // one. The same product id with different options is a SEPARATE cart line.
  option?: string;
}

// Identifies a cart line. Same product + same option merge; different options
// stay separate. No option ⇒ key is just the id (unchanged from before).
export function cartLineKey(item: { id: number; option?: string }): string {
  return item.option ? `${item.id}::${item.option}` : String(item.id);
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  // Operate on a cart LINE (by cartLineKey), not just a product id, so option
  // variants of the same product can be managed independently.
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

// Oversell is allowed by design: customers can order beyond available stock
// (including stock 0 — a backorder). The shortfall is surfaced and gated on the
// admin side (the order can't be packed until stock is replenished), so the cart
// itself never clamps to stock. Only `notForSale` products are blocked, and that
// is enforced at the add-to-cart buttons, not here.
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const key = cartLineKey(item);
        const existing = get().items.find(i => cartLineKey(i) === key);
        if (existing) {
          set(state => ({
            items: state.items.map(i =>
              cartLineKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          }));
        } else {
          set(state => ({ items: [...state.items, { ...item, quantity: 1 }] }));
        }
        set({ isOpen: true });
      },

      removeItem: (key) => {
        set(state => ({ items: state.items.filter(i => cartLineKey(i) !== key) }));
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) {
          get().removeItem(key);
          return;
        }
        set(state => ({
          items: state.items.map(i => (cartLineKey(i) === key ? { ...i, quantity } : i)),
        }));
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set(state => ({ isOpen: !state.isOpen })),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'lumiere-cart',
    }
  )
);
