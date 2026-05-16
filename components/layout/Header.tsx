'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShoppingBag, Search, Menu, X, Globe } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore, type Currency } from '@/lib/currency-store';
import { locales, type Locale } from '@/lib/i18n';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', ko: 'KO' };

export default function Header() {
  const t = useTranslations('nav');
  const params = useParams();
  const pathname = usePathname();
  const locale = params.locale as Locale;

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { totalItems, toggleCart } = useCartStore();
  const { currency, setCurrency } = useCurrencyStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const itemCount = mounted ? totalItems() : 0;
  const displayCurrency = mounted ? currency : 'USD';

  const CURRENCY_CYCLE: Record<string, Currency> = { USD: 'RUB', RUB: 'KRW', KRW: 'USD' };
  const CURRENCY_LABEL: Record<string, string> = { USD: '$ USD', RUB: '₽ RUB', KRW: '₩ 원' };
  function cycleCurrency() { setCurrency(CURRENCY_CYCLE[displayCurrency]); }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setLangOpen(false); }, [pathname]);

  function getLocalePath(newLocale: Locale) {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    return segments.join('/');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/${locale}/catalogue?q=${encodeURIComponent(searchQuery)}`;
    }
    setSearchOpen(false);
  }

  const navLinks = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/catalogue`, label: t('catalogue') },
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/contact`, label: t('contact') },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          scrolled ? 'glassmorphism py-3' : 'py-5 bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="font-display text-2xl font-light tracking-widest hover:text-gold transition-colors duration-300"
            style={{ color: 'var(--page-text)' }}
          >
            Lumière
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-semibold tracking-widest uppercase hover:text-gold transition-colors duration-300"
                style={{ color: 'var(--page-text)' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={t('search')}
              className="p-2 hover:text-gold transition-colors duration-300"
              style={{ color: 'var(--page-text)' }}
            >
              <Search size={17} />
            </button>

            {/* Currency toggle */}
            <button
              onClick={cycleCurrency}
              className="hidden lg:flex items-center text-xs font-semibold tracking-wider hover:text-gold transition-colors duration-300"
              style={{ color: 'var(--page-text)' }}
              title="Switch currency"
            >
              {CURRENCY_LABEL[displayCurrency]}
            </button>

            {/* Language */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-xs font-semibold tracking-wider hover:text-gold transition-colors duration-300"
                style={{ color: 'var(--page-text)' }}
              >
                <Globe size={13} />
                {LOCALE_LABELS[locale]}
              </button>
              {langOpen && (
                <div
                  className="absolute right-0 top-full mt-2 shadow-lg py-1 min-w-[80px] z-50 rounded-lg border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
                >
                  {locales.map(l => (
                    <Link
                      key={l}
                      href={getLocalePath(l)}
                      className={`block px-4 py-2 text-xs font-semibold tracking-wider transition-colors rounded-md mx-1 ${
                        l === locale ? 'text-gold' : 'hover:text-gold'
                      }`}
                      style={{ color: l === locale ? 'var(--accent)' : 'var(--page-text)' }}
                    >
                      {LOCALE_LABELS[l]}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={toggleCart}
              aria-label={t('cart')}
              className="relative p-2 hover:text-gold transition-colors duration-300"
              style={{ color: 'var(--page-text)' }}
            >
              <ShoppingBag size={17} />
              {itemCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)' }}
                >
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 hover:text-gold transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
              style={{ color: 'var(--page-text)' }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div
            className="lg:hidden border-t px-6 py-6 flex flex-col gap-5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
          >
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold tracking-widest uppercase hover:text-gold transition-colors"
                style={{ color: 'var(--page-text)' }}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-3 border-t flex-wrap" style={{ borderColor: 'var(--border-color)' }}>
              {locales.map(l => (
                <Link
                  key={l}
                  href={getLocalePath(l)}
                  className="text-xs font-bold tracking-wider px-3 py-1.5 border rounded-md transition-colors"
                  style={{
                    borderColor: l === locale ? 'var(--accent)' : 'var(--border-color)',
                    color: l === locale ? 'var(--accent)' : 'var(--page-text-2)',
                  }}
                >
                  {LOCALE_LABELS[l]}
                </Link>
              ))}
              {/* Mobile currency */}
              <button
                onClick={cycleCurrency}
                className="text-xs font-bold tracking-wider px-3 py-1.5 border rounded-md transition-colors"
                style={{ borderColor: 'var(--border-color)', color: 'var(--page-text-2)' }}
              >
                {CURRENCY_LABEL[displayCurrency]}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-6"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <div className="w-full max-w-2xl">
            <form
              onSubmit={handleSearch}
              className="flex items-center border rounded-xl overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
            >
              <Search size={17} className="ml-4 flex-shrink-0" style={{ color: 'var(--page-text-2)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                autoFocus
                className="flex-1 px-4 py-4 text-sm bg-transparent outline-none placeholder:opacity-50"
                style={{ color: 'var(--page-text)' }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-4 transition-colors"
                style={{ color: 'var(--page-text-2)' }}
              >
                <X size={17} />
              </button>
            </form>
          </div>
        </div>
      )}

      {langOpen && <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />}
    </>
  );
}
