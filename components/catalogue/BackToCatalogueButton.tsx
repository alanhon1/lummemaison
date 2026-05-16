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
    const referrer = document.referrer;
    if (!referrer) return;

    let url: URL;
    try {
      url = new URL(referrer);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) return;

    // Match /{anyLocale}/catalogue/{categoryId}
    const match = url.pathname.match(/^\/[^/]+\/catalogue\/([^/]+)\/?$/);
    if (!match) return;

    const categoryId = match[1];
    const categoryName = categoriesById[categoryId];
    if (!categoryName) return;

    setTarget({
      href: `/${locale}/catalogue/${categoryId}`,
      label: `Back to ${categoryName}`,
    });
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
