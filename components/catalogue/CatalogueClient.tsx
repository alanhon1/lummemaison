'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, X, LayoutGrid, List, ChevronDown, Download } from 'lucide-react';
import Fuse from 'fuse.js';
import ProductCard from './ProductCard';
import { categories, products, type Product } from '@/lib/products';
import { siteConfig } from '@/lib/site-config';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name';

const fuseOptions = {
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 2 },
    { name: 'specification', weight: 1 },
    { name: 'description', weight: 0.8 },
    { name: 'categoryId', weight: 0.5 },
  ],
};

export default function CatalogueClient({ initialCategory }: { initialCategory?: string }) {
  const t = useTranslations('catalogue');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(initialCategory || '');
  const [saleOnly, setSaleOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 24;

  const fuse = useMemo(() => new Fuse(products, fuseOptions), []);

  // Precompute variant counts once
  const variantCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.groupId) {
        map.set(p.groupId, (map.get(p.groupId) ?? 0) + 1);
      }
    }
    return map;
  }, []);

  const filteredProducts = useMemo(() => {
    let result: Product[] = products;

    // Search
    if (searchQuery.trim()) {
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // Category filter (Bundles sentinel narrows to grouped products only)
    if (activeCategory === '__bundles__') {
      result = result.filter(p => Boolean(p.groupId));
    } else if (activeCategory) {
      result = result.filter(p => p.categoryId === activeCategory);
    }

    // Sale filter
    if (saleOnly) {
      result = result.filter(p => p.isSale);
    }

    // New filter
    if (newOnly) {
      result = result.filter(p => p.isNew);
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Deduplicate grouped products: keep only the first representative per group
    const seenGroups = new Set<string>();
    result = result.filter(p => {
      if (!p.groupId) return true;
      if (seenGroups.has(p.groupId)) return false;
      seenGroups.add(p.groupId);
      return true;
    });

    return result;
  }, [searchQuery, activeCategory, saleOnly, newOnly, sortBy, fuse]);

  const totalPages = Math.ceil(filteredProducts.length / PER_PAGE);
  const paginatedProducts = filteredProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
    if (q) {
      router.replace(`/${locale}/catalogue?q=${encodeURIComponent(q)}`, { scroll: false });
    } else {
      router.replace(`/${locale}/catalogue`, { scroll: false });
    }
  }, [locale, router]);

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(activeCategory === catId ? '' : catId);
    setPage(1);
    setSidebarOpen(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('');
    setSaleOnly(false);
    setNewOnly(false);
    setSortBy('default');
    setPage(1);
  };

  const hasActiveFilters = searchQuery || activeCategory || saleOnly || newOnly;

  return (
    <div className="flex gap-0">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen lg:h-auto lg:top-24 w-72 bg-white border-r border-bone z-30 overflow-y-auto
        flex-shrink-0 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-charcoal">
              {t('filter')}
            </h2>
            <button
              className="lg:hidden text-mist hover:text-charcoal"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Categories */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              {t('allCategories')}
            </h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleCategoryClick('')}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    !activeCategory
                      ? 'bg-obsidian text-cream font-semibold'
                      : 'text-charcoal hover:text-gold hover:bg-cream'
                  }`}
                >
                  All Categories
                  <span className="float-right text-xs opacity-50">{products.length}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('__bundles__')}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    activeCategory === '__bundles__'
                      ? 'bg-gold text-white font-semibold'
                      : 'text-charcoal hover:text-gold hover:bg-cream'
                  }`}
                >
                  Bundles
                  <span className="float-right text-xs opacity-50">{variantCounts.size}</span>
                </button>
              </li>
              {categories.map(cat => {
                const count = products.filter(p => p.categoryId === cat.id).length;
                return (
                  <li key={cat.id}>
                    <button
                      onClick={() => handleCategoryClick(cat.id)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        activeCategory === cat.id
                          ? 'bg-gold text-white font-semibold'
                          : 'text-charcoal hover:text-gold hover:bg-cream'
                      }`}
                    >
                      <span className="line-clamp-1">{cat.name}</span>
                      <span className="float-right text-xs opacity-50">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Quick Filters */}
          <div className="space-y-3 mb-8">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              Quick Filters
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saleOnly}
                onChange={e => { setSaleOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('saleOnly')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={e => { setNewOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('newOnly')}</span>
            </label>
          </div>

          {/* Download PDF */}
          <a
            href={siteConfig.catalogue.pdfUrl}
            download
            className="flex items-center gap-2 text-xs text-mist hover:text-gold transition-colors"
          >
            <Download size={13} />
            {t('downloadPdf')}
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-16 z-20 bg-white border-b border-bone px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase border border-bone px-3 py-2 hover:border-gold hover:text-gold transition-colors"
            >
              <Filter size={13} />
              {t('filter')}
            </button>

            {/* Search */}
            <div className="flex-1 min-w-48 max-w-sm flex items-center gap-2 border border-bone px-3 py-2 focus-within:border-gold transition-colors">
              <Search size={14} className="text-mist flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder={t('search')}
                className="flex-1 text-xs bg-transparent outline-none text-charcoal placeholder-mist"
              />
              {searchQuery && (
                <button onClick={() => handleSearch('')} className="text-mist hover:text-charcoal">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as SortOption); setPage(1); }}
                className="text-xs border border-bone px-3 py-2 pr-7 bg-white text-charcoal outline-none hover:border-gold transition-colors appearance-none cursor-pointer"
              >
                <option value="default">{t('sortDefault')}</option>
                <option value="price-asc">{t('sortPriceAsc')}</option>
                <option value="price-desc">{t('sortPriceDesc')}</option>
                <option value="name">{t('sortName')}</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-mist" />
            </div>

            {/* Layout toggle */}
            <div className="hidden sm:flex border border-bone">
              <button
                onClick={() => setLayout('grid')}
                className={`p-2 ${layout === 'grid' ? 'bg-obsidian text-cream' : 'text-mist hover:text-charcoal'} transition-colors`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setLayout('list')}
                className={`p-2 ${layout === 'list' ? 'bg-obsidian text-cream' : 'text-mist hover:text-charcoal'} transition-colors`}
              >
                <List size={14} />
              </button>
            </div>

            {/* Count */}
            <span className="text-xs text-mist ml-auto">
              {filteredProducts.length} {t('products')}
            </span>

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-mist hover:text-charcoal flex items-center gap-1"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Active category badge */}
          {activeCategory && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-bone">
              <span className="text-xs text-mist">Viewing:</span>
              <span className="text-xs font-semibold text-gold">
                {activeCategory === '__bundles__'
                  ? 'Bundles'
                  : categories.find(c => c.id === activeCategory)?.name}
              </span>
              <button
                onClick={() => setActiveCategory('')}
                className="text-mist hover:text-charcoal"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Products */}
        <div className="p-6">
          {paginatedProducts.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-2xl font-light mb-3">{t('noResults')}</p>
              <p className="text-sm text-mist mb-6">{t('noResultsHint')}</p>
              <button onClick={clearFilters} className="btn-primary text-xs">
                Clear Filters
              </button>
            </div>
          ) : layout === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {paginatedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  layout="grid"
                  variantCount={product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {paginatedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  layout="list"
                  variantCount={product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                disabled={page === 1}
                className="px-4 py-2 text-xs border border-bone hover:border-gold hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 7) {
                  if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => { setPage(pageNum); window.scrollTo(0, 0); }}
                    className={`w-8 h-8 text-xs border transition-colors ${
                      page === pageNum
                        ? 'bg-obsidian text-cream border-obsidian'
                        : 'border-bone hover:border-gold hover:text-gold'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                disabled={page === totalPages}
                className="px-4 py-2 text-xs border border-bone hover:border-gold hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
