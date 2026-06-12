'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { locales, defaultLocale, localePath, type Locale } from '@/lib/i18n';
import type { Announcement } from '@/lib/announcements';

const DISCLAIMER_KEY = 'lumee_disclaimer_agreed';
const DISCLAIMER_EVENT = 'lumee:disclaimer-agreed';
const seenKey = (id: number) => `lumee_announcement_seen_${id}`;

type Page = 'home' | 'catalogue' | null;

// Strip a non-default locale prefix (e.g. /ru/catalogue → /catalogue).
function stripLocale(path: string): string {
  const seg = path.split('/')[1];
  if (seg && seg !== defaultLocale && (locales as readonly string[]).includes(seg)) {
    return path.slice(seg.length + 1) || '/';
  }
  return path || '/';
}

function currentPage(path: string): Page {
  const base = stripLocale(path);
  if (base === '/' || base === '') return 'home';
  if (base === '/catalogue') return 'catalogue';
  return null;
}

export default function AnnouncementModal({ announcements }: { announcements: Announcement[] }) {
  const t = useTranslations('announcements');
  const params = useParams();
  const pathname = usePathname();
  const locale = (params.locale as Locale) ?? defaultLocale;

  const [active, setActive] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;

    // First active announcement targeting this page that the visitor hasn't
    // already dismissed on this device.
    function pick(): Announcement | null {
      const page = currentPage(pathname);
      if (!page) return null;
      const matches = announcements.filter(a =>
        page === 'home'
          ? a.placement === 'home' || a.placement === 'both'
          : a.placement === 'catalogue' || a.placement === 'both',
      );
      for (const a of matches) {
        try {
          if (localStorage.getItem(seenKey(a.id)) !== 'true') return a;
        } catch {
          return a;
        }
      }
      return null;
    }

    // Only show after the welcome disclaimer is accepted, so the two modals
    // never overlap on a first visit.
    function evaluate(): boolean {
      if (cancelled) return true;
      let agreed = false;
      try {
        agreed = localStorage.getItem(DISCLAIMER_KEY) === 'true';
      } catch {
        agreed = true; // localStorage blocked — don't gate forever
      }
      if (!agreed) return false;
      const cand = pick();
      if (cand) setActive(cand);
      return true;
    }

    if (evaluate()) return () => { cancelled = true; };

    const onAgreed = () => evaluate();
    window.addEventListener(DISCLAIMER_EVENT, onAgreed);
    return () => {
      cancelled = true;
      window.removeEventListener(DISCLAIMER_EVENT, onAgreed);
    };
  }, [pathname, announcements]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);

  if (!active) return null;

  function dismiss() {
    if (active) {
      try { localStorage.setItem(seenKey(active.id), 'true'); } catch { /* best effort */ }
    }
    setActive(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: 'rgba(10, 10, 10, 0.72)', backdropFilter: 'blur(2px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl max-h-[92dvh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          boxShadow: 'var(--accent-glow), 0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('close')}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors"
          style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
        >
          <X size={18} />
        </button>

        {active.image_url && (
          <div className="shrink-0 w-full">
            <Image
              src={active.image_url}
              alt={active.title}
              width={1024}
              height={576}
              className="w-full h-auto max-h-[45dvh] object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
          <h2
            id="announcement-title"
            className="font-display italic text-2xl md:text-3xl font-light"
            style={{ color: 'var(--page-text)' }}
          >
            {active.title}
          </h2>
          <div className="gold-divider" />
          <p
            className="text-sm md:text-base whitespace-pre-line leading-relaxed"
            style={{ color: 'var(--page-text-2)' }}
          >
            {active.body}
          </p>
        </div>

        <div className="shrink-0 px-6 md:px-8 pb-6 flex items-center justify-between gap-3">
          <Link
            href={localePath(locale, '/announcements')}
            onClick={dismiss}
            className="text-xs font-semibold tracking-widest uppercase hover:text-gold transition-colors"
            style={{ color: 'var(--page-text-2)' }}
          >
            {t('readMore')}
          </Link>
          <button type="button" onClick={dismiss} className="btn-gold">
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
