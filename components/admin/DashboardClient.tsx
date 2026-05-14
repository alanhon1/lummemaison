'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Grid3X3, ImageOff, Clock, Plus, LogOut } from 'lucide-react';
import type { Product } from '@/lib/products';

interface BackupFile { name: string; size: number; created: string; }

interface Props {
  totalProducts: number;
  totalCategories: number;
  noImageCount: number;
  lastModified: string;
  recentProducts: Pick<Product, 'id' | 'name' | 'categoryId'>[];
  backups: BackupFile[];
}

export default function DashboardClient({ totalProducts, totalCategories, noImageCount, lastModified, recentProducts, backups }: Props) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/manzura/login');
    router.refresh();
  }

  async function handleRestore(filename: string) {
    if (!confirm(`Restore backup "${filename}"? Current data will be overwritten.`)) return;
    setRestoring(filename);
    try {
      await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      router.refresh();
    } finally {
      setRestoring(null);
    }
  }

  const stats = [
    { label: 'Total Products', value: totalProducts, icon: Package },
    { label: 'Categories', value: totalCategories, icon: Grid3X3 },
    { label: 'No Image', value: noImageCount, icon: ImageOff },
    { label: 'Last Edit', value: lastModified, icon: Clock, isText: true },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Dashboard</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">Lumière Admin Panel</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-mist hover:text-charcoal border border-bone px-4 py-2 transition-colors">
          <LogOut size={13} />
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-bone p-5">
            <s.icon size={18} className="text-gold mb-3" strokeWidth={1.5} />
            <div className={`font-display font-light text-charcoal mb-1 ${s.isText ? 'text-lg' : 'text-3xl'}`}>
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-mist">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/manzura/products/new" className="btn-gold text-xs flex items-center gap-2">
          <Plus size={14} />
          New Product
        </Link>
        <Link href="/manzura/products?filter=no-image" className="btn-secondary text-xs flex items-center gap-2">
          <ImageOff size={14} />
          Missing Images ({noImageCount})
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent */}
        <div className="bg-white border border-bone p-6">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-4">Recent Products</h2>
          <div className="space-y-2">
            {recentProducts.map(p => (
              <Link key={p.id} href={`/manzura/products/${p.id}`}
                className="flex items-center justify-between py-2 border-b border-bone/50 hover:text-gold transition-colors text-sm">
                <span className="text-mist text-xs">#{p.id}</span>
                <span className="flex-1 px-3 truncate">{p.name}</span>
                <span className="text-xs text-mist">{p.categoryId}</span>
              </Link>
            ))}
          </div>
          <Link href="/manzura/products" className="text-xs text-gold hover:underline mt-4 block">
            View all products →
          </Link>
        </div>

        {/* Backups */}
        <div className="bg-white border border-bone p-6">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-4">Backups</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {backups.length === 0 && <p className="text-xs text-mist">No backups yet</p>}
            {backups.map(b => (
              <div key={b.name} className="flex items-center justify-between text-xs py-1.5 border-b border-bone/50">
                <span className="text-mist truncate mr-2">{b.created}</span>
                <span className="text-mist mr-auto">{(b.size / 1024).toFixed(0)}KB</span>
                <button
                  onClick={() => handleRestore(b.name)}
                  disabled={restoring === b.name}
                  className="text-gold hover:underline disabled:opacity-50 ml-3"
                >
                  {restoring === b.name ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
