'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'classic' | 'neon' | 'paris';

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const THEMES: { id: Theme; label: string; accent: string; bg: string }[] = [
  { id: 'classic', label: 'Lumière', accent: '#C9A96E', bg: '#FAF8F5' },
  { id: 'neon',    label: 'Neon Violet', accent: '#A855F7', bg: '#08061A' },
  { id: 'paris',   label: 'Soir de Paris', accent: '#C9A96E', bg: '#070C18' },
];

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'classic',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'lumiere-theme' }
  )
);
