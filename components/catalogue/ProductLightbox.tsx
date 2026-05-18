'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ProductImage from './ProductImage';
import type { GalleryItem } from './ProductGallery';

interface ProductLightboxProps {
  open: boolean;
  onClose: () => void;
  items: GalleryItem[];
  activeIdx: number;
  onPrev: () => void;
  onNext: () => void;
  categoryId: string;
}

export default function ProductLightbox({
  open,
  onClose,
  items,
  activeIdx,
  onPrev,
  onNext,
  categoryId,
}: ProductLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previouslyFocused.current = document.activeElement;
    // Focus the close button on open.
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = original;
      // Restore focus on close.
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open]);

  // Keyboard handling: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;
  if (items.length === 0) return null;

  const current = items[activeIdx];

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        ref={closeButtonRef}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <div
        className="relative"
        style={{ maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          key={`lightbox-${activeIdx}`}
          className="w-[90vw] h-[85vh] flex items-center justify-center"
        >
          <div className="relative w-full h-full">
            <ProductImage
              src={current.src}
              alt={current.alt}
              productId={current.productId}
              categoryId={categoryId}
              fill={false}
            />
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute top-1/2 left-6 -translate-y-1/2 w-12 h-12 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute top-1/2 right-6 -translate-y-1/2 w-12 h-12 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cream text-sm tracking-wider">
          {activeIdx + 1} / {items.length}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
