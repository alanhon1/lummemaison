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
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
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
        const existing = get().items.find(i => i.id === item.id);
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
              i.id === item.id ? { ...i, quantity: next } : i,
            ),
          }));
        } else {
          set(state => ({ items: [...state.items, { ...item, quantity: next }] }));
        }
        set({ isOpen: true });
      },

      removeItem: (id) => {
        set(state => ({ items: state.items.filter(i => i.id !== id) }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        const clamped = clampToStock(id, quantity);
        if (clamped === 0) {
          get().removeItem(id);
          return;
        }
        set(state => ({
          items: state.items.map(i => (i.id === id ? { ...i, quantity: clamped } : i)),
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
