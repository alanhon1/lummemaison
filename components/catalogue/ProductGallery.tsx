'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductImage from './ProductImage';

interface ProductGalleryProps {
  mainImage: string;
  extraImages: string[];
  alt: string;
  productId: number;
  categoryId: string;
  categoryName?: string;
  badges?: React.ReactNode;
}

export default function ProductGallery({
  mainImage,
  extraImages,
  alt,
  productId,
  categoryId,
  categoryName,
  badges,
}: ProductGalleryProps) {
  const allImages = [mainImage, ...extraImages].filter(Boolean);

  // Ping-pong crossfade layers.
  // `front` is the visible layer; `back` is preloaded for the next transition.
  const [activeIdx, setActiveIdx] = useState(0);
  const [layers, setLayers] = useState<{ a: number; b: number; front: 'a' | 'b' }>({
    a: 0,
    b: 0,
    front: 'a',
  });

  useEffect(() => {
    setLayers(prev => {
      if (prev[prev.front] === activeIdx) return prev;
      // Load new image into the back layer and swap.
      return prev.front === 'a'
        ? { a: prev.a, b: activeIdx, front: 'b' }
        : { a: activeIdx, b: prev.b, front: 'a' };
    });
  }, [activeIdx]);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIdx(i => (i - 1 + allImages.length) % allImages.length);
      } else if (e.key === 'ArrowRight') {
        setActiveIdx(i => (i + 1) % allImages.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allImages.length]);

  const srcA = allImages[layers.a] ?? mainImage;
  const srcB = allImages[layers.b] ?? mainImage;

  return (
    <div className="lg:sticky lg:top-28">
      <div className="border border-bone aspect-square relative overflow-hidden">
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
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + allImages.length) % allImages.length)}
              className="absolute top-1/2 left-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % allImages.length)}
              className="absolute top-1/2 right-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-2 mt-3">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
                activeIdx === i ? 'border-gold' : 'border-bone hover:border-gold/50'
              }`}
            >
              <ProductImage
                src={img}
                alt={`${alt} view ${i + 1}`}
                productId={productId}
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
