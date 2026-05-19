'use client';

import Image from 'next/image';

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  'filler':          ['#f5f0e8', '#ede5d4'],
  'toxin':           ['#edf0f5', '#dde3ed'],
  'skin-booster':    ['#f0f5ed', '#ddebd5'],
  'thread':          ['#f5f0f0', '#edddd5'],
  'pdo':             ['#f5f0f0', '#edddd5'],
  'prp':             ['#edf5f5', '#d5ebeb'],
  'exosome':         ['#f5edf5', '#edd5ed'],
  'meso':            ['#f5f5ed', '#ebebd5'],
  'enzyme':          ['#f0edf5', '#d8d5ed'],
  'laser':           ['#f5f0eb', '#ede4d5'],
  'peel':            ['#f5f5eb', '#ebebd5'],
  'mask':            ['#ebf5f0', '#d5edd5'],
  'solution':        ['#f0f5f5', '#d5e8eb'],
};

function getGradient(categoryId: string): [string, string] {
  for (const key of Object.keys(CATEGORY_GRADIENTS)) {
    if (categoryId.toLowerCase().includes(key)) return CATEGORY_GRADIENTS[key];
  }
  return ['#f5f0e8', '#ede5d4'];
}

interface ProductImageProps {
  src: string;
  alt: string;
  productId: number;
  categoryId: string;
  categoryName?: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export default function ProductImage({
  src,
  alt,
  productId,
  categoryId,
  categoryName,
  fill = true,
  className = '',
  sizes,
  priority = false,
}: ProductImageProps) {
  const [from, to] = getGradient(categoryId);

  if (src) {
    return fill ? (
      <Image src={src} alt={alt} fill className={`object-contain ${className}`} sizes={sizes} priority={priority} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`w-full h-full object-contain ${className}`} />
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center select-none ${className}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-label={alt}
    >
      <div
        className="font-display text-5xl font-light tracking-widest"
        style={{ color: 'rgba(160,130,80,0.35)' }}
      >
        {String(productId).padStart(3, '0')}
      </div>
      <div
        className="mt-2 h-px w-8"
        style={{ background: 'rgba(201,169,110,0.4)' }}
      />
      {categoryName && (
        <div
          className="mt-2 text-[9px] tracking-[0.25em] uppercase font-medium"
          style={{ color: 'rgba(120,100,70,0.5)' }}
        >
          {categoryName}
        </div>
      )}
    </div>
  );
}
