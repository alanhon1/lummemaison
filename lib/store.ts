'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStockStore } from './stock-store';

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

// Clamp a desired quantity to whatever stock the client currently knows about.
// Returns the desired quantity if stock is unknown (server-side RPC will catch
// any genuine oversell at order time). Returns 0 if stock is known and 0.
function clampToStock(id: number, desired: number): number {
  if (desired < 0) return 0;
  const known = useStockStore.getState().stockMap[id];
  if (typeof known !== 'number') return desired;
  return Math.min(desired, known);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const key = cartLineKey(item);
        const existing = get().items.find(i => cartLineKey(i) === key);
        const desired = (existing?.quantity ?? 0) + 1;
        const next = clampToStock(item.id, desired);
        if (next === 0) return; // stock known to be 0 — drop silently
        if (existing && next === existing.quantity) {
          // Already at stock ceiling. Open the cart so the user notices.
          set({ isOpen: true });
          return;
        }
        if (existing) {
          set(state => ({
            items: state.items.map(i =>
              cartLineKey(i) === key ? { ...i, quantity: next } : i,
            ),
          }));
        } else {
          set(state => ({ items: [...state.items, { ...item, quantity: next }] }));
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
        const line = get().items.find(i => cartLineKey(i) === key);
        const clamped = line ? clampToStock(line.id, quantity) : quantity;
        if (clamped === 0) {
          get().removeItem(key);
          return;
        }
        set(state => ({
          items: state.items.map(i => (cartLineKey(i) === key ? { ...i, quantity: clamped } : i)),
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
