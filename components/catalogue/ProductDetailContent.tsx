'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { Product } from '@/lib/products';
import {
  getLocalizedDescription,
  getLocalizedIndication,
  getLocalizedPackaging,
  getLocalizedProtocol,
} from '@/lib/products';
import { localePath } from '@/lib/i18n';

interface Props {
  product: Product;
  locale: string;
  labels: {
    description: string;
    indication: string;
    packaging: string;
    protocol: string;
  };
}

function CollapsibleBlock({ label, body, threshold = 240 }: { label: string; body: string; threshold?: number }) {
  const t = useTranslations('product');
  const [expanded, setExpanded] = useState(false);
  const text = body || '—';
  const isLong = text.length > threshold;

  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-2">
        {label}
      </h3>
      <p
        className={`text-sm text-charcoal leading-relaxed whitespace-pre-line ${
          isLong && !expanded ? 'line-clamp-3 md:line-clamp-none' : ''
        }`}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="md:hidden mt-2 text-xs font-semibold tracking-wider uppercase text-gold hover:text-gold-dark transition-colors"
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  );
}

export default function ProductDetailContent({ product, locale, labels }: Props) {
  const description = getLocalizedDescription(product, locale);
  const indication = getLocalizedIndication(product, locale);
  const packaging = getLocalizedPackaging(product, locale);
  const protocol = getLocalizedProtocol(product, locale);
  const tags = (product.tags ?? []).filter(t => t && t.toLowerCase() !== 'sale' && t.toLowerCase() !== 'new');

  return (
    <section className="mt-10 bg-white border border-bone rounded-sm p-5 md:p-8">
      <CollapsibleBlock label={labels.description} body={description} threshold={320} />

      <div className="gold-divider my-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CollapsibleBlock label={labels.indication} body={indication} />
        <CollapsibleBlock label={labels.packaging} body={packaging} />
        <CollapsibleBlock label={labels.protocol} body={protocol} />
      </div>

      {tags.length > 0 && (
        <>
          <div className="gold-divider my-6" />
          <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 20).map(tag => (
              <Link
                key={tag}
                href={localePath(locale, `/catalogue?q=${encodeURIComponent(tag)}`)}
                className="tag-chip"
                title={`Search "${tag}"`}
              >
                #{tag.replace(/\s+/g, '')}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
