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
  const [activeIdx, setActiveIdx] = useState(0);

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

  return (
    <div className="lg:sticky lg:top-28">
      {/* Main image */}
      <div className="border border-bone aspect-square relative overflow-hidden">
        <ProductImage
          src={allImages[activeIdx] ?? mainImage}
          alt={alt}
          productId={productId}
          categoryId={categoryId}
          categoryName={categoryName}
          fill={false}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        {badges && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
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

      {/* Thumbnails — only shown when there are extra images */}
      {allImages.length > 1 && (
        <div className="flex gap-2 mt-3">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
                activeIdx === i
                  ? 'border-gold'
                  : 'border-bone hover:border-gold/50'
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
