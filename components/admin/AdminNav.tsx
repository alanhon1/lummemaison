'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, ShoppingCart, Package, BarChart3, MessageSquare, Users, Warehouse, LogOut, BrainCircuit, AlertCircle, Inbox, Tag, Bell, Megaphone } from 'lucide-react';

// Admin navigation. Mounted in app/manzura/layout.tsx; suppresses itself on
// /manzura/login so the login page stays clean.
//
// Responsive: a top bar (logo + logout, plus inline tabs on desktop) and, on
// mobile, a fixed bottom tab bar (icons + short labels) so the four sections
// stay reachable without horizontal scroll on a phone.

const TABS: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> = [
  { href: '/manzura', label: 'Home', icon: LayoutDashboard },
  { href: '/manzura/orders', label: 'Orders', icon: ClipboardList },
  { href: '/manzura/procurement', label: 'Items', icon: ShoppingCart },
  { href: '/manzura/products', label: 'Products', icon: Package },
  { href: '/manzura/promos', label: 'Promos', icon: Tag },
  { href: '/manzura/referrals', label: 'Referrals', icon: Megaphone },
  { href: '/manzura/status', label: 'Status', icon: BarChart3 },
  { href: '/manzura/feedbacks', label: 'Reviews', icon: MessageSquare },
  { href: '/manzura/issues', label: 'Issues', icon: AlertCircle },
  { href: '/manzura/requests', label: 'Requests', icon: Inbox },
  { href: '/manzura/users', label: 'Users', icon: Users },
  { href: '/manzura/stock', label: 'Stock', icon: Warehouse },
  { href: '/manzura/questions', label: 'AI Q', icon: BrainCircuit },
];

export default function AdminNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Poll the admin notification badge (order alerts). Light: every 60s, and
  // again whenever the route changes (so opening the inbox clears it quickly).
  useEffect(() => {
    if (pathname === '/manzura/login') return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/admin/notifications/unread-count', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setUnread(d.count ?? 0);
      } catch {
        /* ignore — badge is best-effort */
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [pathname]);

  if (pathname === '/manzura/login') return null;

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/manzura/login');
    router.refresh();
  }

  // "Dashboard" is matched only on exact /manzura — otherwise it would always
  // appear active.
  function isActive(tab: typeof TABS[number]): boolean {
    if (tab.href === '/manzura') return pathname === '/manzura';
    return pathname.startsWith(tab.href);
  }

  return (
    <>
      {/* Top bar */}
      <header className="bg-white border-b border-bone sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-6 h-14">
          <Link href="/manzura" className="font-display italic text-lg text-charcoal mr-2">
            Lumée Admin
          </Link>
          {/* Inline tabs — desktop only */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {TABS.map(t => {
              const active = isActive(t);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest rounded transition-colors ${
                    active
                      ? 'bg-charcoal text-cream'
                      : 'text-mist hover:text-charcoal hover:bg-cream'
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/manzura/notifications"
            aria-label="Notifications"
            className="relative inline-flex items-center justify-center text-mist hover:text-charcoal ml-auto md:ml-0"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gold text-white text-[10px] leading-4 text-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-mist hover:text-charcoal ml-4 md:ml-2"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-bone flex pb-[env(safe-area-inset-bottom)] print:hidden">
        {TABS.map(t => {
          const active = isActive(t);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] tracking-wide transition-colors ${
                active ? 'text-gold-dark' : 'text-mist'
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
