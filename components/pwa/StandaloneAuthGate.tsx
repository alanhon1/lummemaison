'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Phase 3: when the customer app runs as an installed PWA (display-mode
// standalone, or iOS navigator.standalone), require login. The public browser
// site is untouched — this only acts inside the installed app, so SEO/anonymous
// browsing on the web stays open. Auth pages are exempt to avoid a redirect loop.
const AUTH_PATH_RE = /\/(account\/(login|signup|forgot-password|reset-password)|auth\/)/;

export default function StandaloneAuthGate({
  isAuthed,
  locale,
}: {
  isAuthed: boolean;
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  useEffect(() => {
    if (isAuthed) return;
    if (AUTH_PATH_RE.test(pathname)) return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    router.replace(`/${locale}/account/login`);
  }, [isAuthed, pathname, locale, router]);

  return null;
}
