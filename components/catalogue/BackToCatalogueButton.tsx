'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackToCatalogueButtonProps {
  locale: string;
  categoriesById: Record<string, string>;
}

interface BackTarget {
  href: string;
  label: string;
}

export default function BackToCatalogueButton({
  locale,
  categoriesById,
}: BackToCatalogueButtonProps) {
  const [target, setTarget] = useState<BackTarget>({
    href: `/${locale}/catalogue`,
    label: 'Back to Catalogue',
  });

  useEffect(() => {
    // Prefer the URL we saved when the user clicked into the product.
    const saved = typeof window !== 'undefined'
      ? sessionStorage.getItem('catalogue:lastUrl')
      : null;

    if (saved) {
      const m1 = saved.match(/^\/[^/]+\/catalogue(?:\/([^/]+))?/);
      const categoryId = m1 && m1[1];
      const categoryName = categoryId ? categoriesById[categoryId] : undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTarget({
        href: saved,
        label: categoryName ? `Back to ${categoryName}` : 'Back to Catalogue',
      });
      return;
    }

    // Fallback: try document.referrer (covers arrivals from outside the app).
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    if (!referrer) return;
    let url: URL;
    try { url = new URL(referrer); } catch { return; }
    if (url.origin !== window.location.origin) return;
    const m2 = url.pathname.match(/^\/[^/]+\/catalogue(?:\/([^/]+))?\/?$/);
    if (!m2) return;
    const categoryId = m2[1];
    const categoryName = categoryId ? categoriesById[categoryId] : undefined;
    const href = url.pathname + url.search;
    const label = categoryName ? `Back to ${categoryName}` : 'Back to Catalogue';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget({ href, label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href={target.href}
      className="inline-flex items-center gap-2 mb-6 px-4 py-3 text-sm font-semibold tracking-wider uppercase text-charcoal hover:text-gold transition-colors duration-300 border border-bone hover:border-gold rounded-md"
    >
      <ArrowLeft size={16} />
      {target.label}
    </Link>
  );
}
