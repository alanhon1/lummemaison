'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/theme-store';

export default function ThemeProvider() {
  const theme = useThemeStore(s => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'classic') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return null;
}
