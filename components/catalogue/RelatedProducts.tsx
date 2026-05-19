'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
import type { Product } from '@/lib/products';

interface RelatedProductsProps {
  products: Product[];
  title: string;
}

const PER_PAGE = 4;

export default function RelatedProducts({ products, title }: RelatedProductsProps) {
  const [page, setPage] = useState(0);
  const [fading, setFading] = useState(false);

  if (products.length === 0) return null;

  const totalPages = Math.ceil(products.length / PER_PAGE);
  const visible = products.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  function goTo(next: number) {
    if (next === page || next < 0 || next >= totalPages) return;
    setFading(true);
    setTimeout(() => {
      setPage(next);
      setFading(false);
    }, 180);
  }

  return (
    <div className="mt-20">
      <div className="flex items-end justify-between mb-8 gap-4">
        <h2 className="section-title">{title}</h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(page - 1)}
              disabled={page === 0}
              aria-label="Previous page"
              className="w-9 h-9 border border-bone rounded-md flex items-center justify-center text-charcoal hover:border-gold hover:text-gold transition-colors disabled:opacity-30 disabled:hover:border-bone disabled:hover:text-charcoal"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Page ${i + 1}`}
                className={`w-9 h-9 border rounded-md text-xs font-semibold transition-colors ${
                  i === page
                    ? 'bg-obsidian text-cream border-obsidian'
                    : 'border-bone hover:border-gold hover:text-gold'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => goTo(page + 1)}
              disabled={page === totalPages - 1}
              aria-label="Next page"
              className="w-9 h-9 border border-bone rounded-md flex items-center justify-center text-charcoal hover:border-gold hover:text-gold transition-colors disabled:opacity-30 disabled:hover:border-bone disabled:hover:text-charcoal"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-200 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {visible.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
