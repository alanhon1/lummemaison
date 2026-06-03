'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Package, LogOut } from 'lucide-react';

// Top-bar admin navigation. Mounted in app/manzura/layout.tsx; suppresses
// itself on /manzura/login so the login page stays clean.

const TABS: Array<{ href: string; label: string; icon: typeof LayoutDashboard; matchPrefix?: string }> = [
  { href: '/manzura', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: '/manzura' },
  { href: '/manzura/orders', label: 'Orders', icon: ClipboardList, matchPrefix: '/manzura/orders' },
  { href: '/manzura/products', label: 'Products', icon: Package, matchPrefix: '/manzura/products' },
];

export default function AdminNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();

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
    <header className="bg-white border-b border-bone sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 flex items-center gap-6 h-14">
        <Link href="/manzura" className="font-display italic text-lg text-charcoal mr-2">
          Lumée Admin
        </Link>
        <nav className="flex items-center gap-1 flex-1">
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
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs text-mist hover:text-charcoal"
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </header>
  );
}
