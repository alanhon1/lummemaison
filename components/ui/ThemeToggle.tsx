'use client';

import { useState } from 'react';
import { useThemeStore, THEMES, type Theme } from '@/lib/theme-store';
import { Palette, X } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold tracking-wider hover:text-gold transition-colors duration-300"
        aria-label="Change theme"
        title="Change theme"
      >
        <Palette size={15} />
        <span className="hidden xl:inline">Theme</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute right-0 top-full mt-3 z-40 p-3 shadow-xl border rounded-xl"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border-color)',
              minWidth: '180px',
            }}
          >
            <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--page-text-2)' }}>
                Theme
              </span>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--page-text-2)' }}>
                <X size={12} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id as Theme); setOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left w-full"
                  style={{
                    background: theme === t.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    borderLeft: theme === t.id ? `3px solid var(--accent)` : '3px solid transparent',
                  }}
                >
                  {/* Color swatch */}
                  <div className="flex gap-1 flex-shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ background: t.bg, borderColor: 'rgba(128,128,128,0.3)' }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: t.accent }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium tracking-wide"
                    style={{ color: theme === t.id ? 'var(--accent)' : 'var(--page-text)' }}
                  >
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
