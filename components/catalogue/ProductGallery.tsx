'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductImage from './ProductImage';

export type GalleryItem = {
  productId: number;
  href: string;
  src: string;
  alt: string;
  variantLabel?: string;
};

interface ProductGalleryProps {
  items: GalleryItem[];
  initialActiveIndex: number;
  alt: string;
  productId: number;
  categoryId: string;
  categoryName?: string;
  badges?: React.ReactNode;
}

export default function ProductGallery({
  items,
  initialActiveIndex,
  alt,
  productId,
  categoryId,
  categoryName,
  badges,
}: ProductGalleryProps) {
  const safeInitial = Math.max(0, Math.min(initialActiveIndex, items.length - 1));

  // Ping-pong crossfade layers.
  const [activeIdx, setActiveIdx] = useState(safeInitial);
  const [layers, setLayers] = useState<{ a: number; b: number; front: 'a' | 'b' }>({
    a: safeInitial,
    b: safeInitial,
    front: 'a',
  });
  const [trackedIdx, setTrackedIdx] = useState(safeInitial);
  const [trackedInitial, setTrackedInitial] = useState(safeInitial);

  // Resync at render-time if the parent passes a new initialActiveIndex
  // (Task 4 boundary crossing). React-canonical pattern, accepted by the compiler.
  if (trackedInitial !== safeInitial) {
    setTrackedInitial(safeInitial);
    setActiveIdx(safeInitial);
  }

  // Render-time state update: swap layers when activeIdx changes.
  if (trackedIdx !== activeIdx) {
    setTrackedIdx(activeIdx);
    setLayers(prev =>
      prev[prev.front] === activeIdx
        ? prev
        : prev.front === 'a'
          ? { a: prev.a, b: activeIdx, front: 'b' }
          : { a: activeIdx, b: prev.b, front: 'a' }
    );
  }

  const router = useRouter();

  const goTo = (rawIdx: number) => {
    if (items.length === 0) return;
    const nextIdx = ((rawIdx % items.length) + items.length) % items.length;
    if (nextIdx === activeIdx) return;
    const crossingBoundary = items[nextIdx].productId !== items[activeIdx].productId;
    setActiveIdx(nextIdx);
    if (crossingBoundary) {
      router.push(items[nextIdx].href, { scroll: false });
    }
  };

  useEffect(() => {
    const uniqueHrefs = new Set(items.map(it => it.href));
    uniqueHrefs.forEach(href => router.prefetch(href));
  }, [items, router]);

  useEffect(() => {
    if (items.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goTo(activeIdx - 1);
      } else if (e.key === 'ArrowRight') {
        goTo(activeIdx + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, items.length]);

  // Empty-items fallback (post-photo-wipe: items.length === 0).
  if (items.length === 0) {
    return (
      <div className="lg:sticky lg:top-28">
        <div className="border border-bone aspect-square relative overflow-hidden">
          <ProductImage
            src=""
            alt={alt}
            productId={productId}
            categoryId={categoryId}
            categoryName={categoryName}
            fill={false}
          />
          {badges && (
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
              {badges}
            </div>
          )}
        </div>
      </div>
    );
  }

  const srcA = items[layers.a]?.src ?? '';
  const srcB = items[layers.b]?.src ?? '';

  return (
    <div className="lg:sticky lg:top-28">
      <div
        className="border border-bone aspect-square relative overflow-hidden"
      >
        {/* Layer A */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: layers.front === 'a' ? 1 : 0 }}
        >
          <ProductImage
            src={srcA}
            alt={alt}
            productId={productId}
            categoryId={categoryId}
            categoryName={categoryName}
            fill={false}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        {/* Layer B */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: layers.front === 'b' ? 1 : 0 }}
        >
          <ProductImage
            src={srcB}
            alt={alt}
            productId={productId}
            categoryId={categoryId}
            categoryName={categoryName}
            fill={false}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        {badges && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
            {badges}
          </div>
        )}
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(activeIdx - 1); }}
              className="absolute top-1/2 left-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(activeIdx + 1); }}
              className="absolute top-1/2 right-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 mt-3">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
                activeIdx === i ? 'border-gold' : 'border-bone hover:border-gold/50'
              }`}
              aria-label={it.variantLabel ? `${it.alt} (${it.variantLabel}) view ${i + 1}` : `${alt} view ${i + 1}`}
            >
              <ProductImage
                src={it.src}
                alt={`${alt} view ${i + 1}`}
                productId={it.productId}
                categoryId={categoryId}
                fill={false}
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
