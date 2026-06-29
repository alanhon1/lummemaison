'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ClipboardList,
  Package,
  Inbox,
  Truck,
  AlertTriangle,
  ShieldCheck,
  Tag,
  Megaphone,
  Bell,
} from 'lucide-react';
import BackupPreviewModal from './BackupPreviewModal';

interface BackupFile { name: string; size: number; created: string; productCount: number; }

interface RecentOrder {
  id: number;
  display: string;
  status: string;
  customer: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

interface Props {
  newOrdersToday: number;
  awaitingVerification: number;
  awaitingShipment: number;
  lowStockCount: number;
  totalProducts: number;
  totalCategories: number;
  recentOrders: RecentOrder[];
  backups: BackupFile[];
  unreadNotifs: number;
}

// Admin-side status palette (kept in sync with app/manzura/orders/page.tsx).
function statusPill(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    order_received:   { cls: 'bg-cream text-gold-dark border border-gold/30', label: 'Received' },
    payment_verified: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Payment verified' },
    packaging:        { cls: 'bg-amber-50 text-amber-800 border border-amber-200', label: 'Packing' },
    shipped:          { cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200', label: 'Shipped' },
    delivered:        { cls: 'bg-charcoal text-cream border border-charcoal', label: 'Delivered' },
    cancelled:        { cls: 'bg-stone-100 text-stone-500 border border-stone-300 line-through', label: 'Cancelled' },
  };
  return map[status] ?? { cls: 'bg-gray-100 text-gray-700', label: status };
}

function formatTotal(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

export default function DashboardClient({
  newOrdersToday,
  awaitingVerification,
  awaitingShipment,
  lowStockCount,
  totalProducts,
  totalCategories,
  recentOrders,
  backups,
  unreadNotifs,
}: Props) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [backupError, setBackupError] = useState('');

  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  async function postBackup(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Request failed');
    }
  }

  async function handleCreate() {
    setBackupError('');
    setCreating(true);
    try {
      await postBackup({ action: 'create' });
      router.refresh();
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(name: string) {
    if (!confirm('Restoring this backup will overwrite the entire current catalogue. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone. (The current state is automatically backed up right before restoring.)')) return;
    setBackupError('');
    setRestoring(name);
    try {
      await postBackup({ action: 'restore', name });
      router.refresh();
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(null);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm('Delete this backup?')) return;
    setBackupError('');
    setDeleting(name);
    try {
      await postBackup({ action: 'delete', name });
      router.refresh();
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  // Operational stats card definitions.
  const stats: Array<{
    label: string;
    value: number;
    icon: typeof Inbox;
    href: string;
    emphasis?: 'attention' | 'caution';
  }> = [
    { label: 'New today', value: newOrdersToday, icon: Inbox, href: '/manzura/orders' },
    { label: 'Awaiting verification', value: awaitingVerification, icon: ShieldCheck, href: '/manzura/orders?status=order_received', emphasis: awaitingVerification > 0 ? 'attention' : undefined },
    { label: 'Awaiting shipment', value: awaitingShipment, icon: Truck, href: '/manzura/orders?status=packaging', emphasis: awaitingShipment > 0 ? 'attention' : undefined },
    { label: 'Low / out of stock', value: lowStockCount, icon: AlertTriangle, href: '/manzura/products?filter=low-stock', emphasis: lowStockCount > 0 ? 'caution' : undefined },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Dashboard</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">
            {totalProducts} products · {totalCategories} categories
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/manzura/announcements"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream px-4 py-2 rounded transition-colors"
          >
            <Megaphone size={14} /> News
          </Link>
          <Link
            href="/manzura/promos"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream px-4 py-2 rounded transition-colors"
          >
            <Tag size={14} /> Promos
          </Link>
          <Link
            href="/manzura/requests"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream px-4 py-2 rounded transition-colors"
          >
            <Inbox size={14} /> Requests
          </Link>
          <Link
            href="/manzura/notifications"
            className="relative inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream px-4 py-2 rounded transition-colors"
          >
            <Bell size={14} /> Notifications
            {unreadNotifs > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[10px] leading-[18px] text-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Operational stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(s => {
          const ringCls =
            s.emphasis === 'attention'
              ? 'ring-2 ring-gold/40'
              : s.emphasis === 'caution'
              ? 'ring-2 ring-rose-300/60'
              : '';
          const valueCls =
            s.emphasis === 'attention'
              ? 'text-charcoal'
              : s.emphasis === 'caution'
              ? 'text-rose-700'
              : 'text-charcoal';
          return (
            <Link
              key={s.label}
              href={s.href}
              className={`block bg-white border border-bone p-5 hover:border-gold transition-colors group ${ringCls}`}
            >
              <s.icon size={18} className="text-gold mb-3" strokeWidth={1.5} />
              <div className={`font-display font-light text-3xl mb-1 ${valueCls}`}>
                {s.value}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-mist">{s.label}</span>
                <ArrowRight size={12} className="text-mist group-hover:text-gold-dark transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent orders + secondary panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Recent orders — primary panel, spans 2 cols on desktop */}
        <div className="bg-white border border-bone p-6 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist">Recent orders</h2>
            <Link href="/manzura/orders" className="text-xs text-gold hover:underline">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-mist italic py-6 text-center border border-dashed border-bone">
              No orders yet.
            </p>
          ) : (
            <ul className="divide-y divide-bone">
              {recentOrders.map(o => {
                const pill = statusPill(o.status);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/manzura/orders/${o.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-cream/50 -mx-2 px-2 transition-colors"
                    >
                      <span className="font-mono text-sm text-charcoal w-24 truncate">{o.display}</span>
                      <span className="flex-1 text-sm text-charcoal truncate">{o.customer}</span>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap ${pill.cls}`}>
                        {pill.label}
                      </span>
                      <span className="text-sm text-charcoal w-20 text-right whitespace-nowrap">
                        {formatTotal(o.total_cents, o.currency)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white border border-bone p-6">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-4">Quick links</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/manzura/orders" className="flex items-center justify-between py-2 text-sm text-charcoal hover:text-gold-dark transition-colors">
                <span className="inline-flex items-center gap-2"><ClipboardList size={14} /> All orders</span>
                <ArrowRight size={12} />
              </Link>
            </li>
            <li>
              <Link href="/manzura/products" className="flex items-center justify-between py-2 text-sm text-charcoal hover:text-gold-dark transition-colors">
                <span className="inline-flex items-center gap-2"><Package size={14} /> Products & stock</span>
                <ArrowRight size={12} />
              </Link>
            </li>
            <li>
              <Link href="/manzura/products/new" className="flex items-center justify-between py-2 text-sm text-charcoal hover:text-gold-dark transition-colors">
                <span className="inline-flex items-center gap-2"><Package size={14} /> Add a product</span>
                <ArrowRight size={12} />
              </Link>
            </li>
            <li>
              <Link href="/manzura/settings" className="flex items-center justify-between py-2 text-sm text-charcoal hover:text-gold-dark transition-colors">
                <span className="inline-flex items-center gap-2"><AlertTriangle size={14} /> Site settings</span>
                <ArrowRight size={12} />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Catalogue backups — de-emphasised. Manual snapshot / restore / delete. */}
      <details className="bg-white border border-bone p-6">
        <summary className="text-xs font-semibold tracking-[0.2em] uppercase text-mist cursor-pointer hover:text-charcoal">
          Catalogue backups ({backups.length}/3)
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="text-xs border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {creating ? 'Backing up…' : 'Create backup now'}
            </button>
            <span className="text-[11px] text-mist">
              Keeps up to 3 · Restore overwrites the current catalogue (2 confirmations, auto-backup before restore)
            </span>
          </div>

          {backupError && <p className="text-xs text-rose-600">{backupError}</p>}

          {backups.length === 0 ? (
            <p className="text-xs text-mist">No backups yet.</p>
          ) : (
            <ul className="space-y-1">
              {backups.map(b => (
                <li key={b.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs py-1.5 border-b border-bone/50">
                  <span className="text-mist whitespace-nowrap">
                    {b.created ? new Date(b.created).toLocaleString() : '—'}
                  </span>
                  <span className="text-charcoal whitespace-nowrap">· {b.productCount} products</span>
                  <span className="text-mist whitespace-nowrap">· {(b.size / 1024).toFixed(0)}KB</span>
                  <div className="ml-auto flex items-center gap-3">
                    <button onClick={() => setPreviewName(b.name)} className="text-charcoal hover:underline">
                      Preview
                    </button>
                    <button
                      onClick={() => handleRestore(b.name)}
                      disabled={restoring === b.name}
                      className="text-gold hover:underline disabled:opacity-50"
                    >
                      {restoring === b.name ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      onClick={() => handleDelete(b.name)}
                      disabled={deleting === b.name}
                      className="text-rose-600 hover:underline disabled:opacity-50"
                    >
                      {deleting === b.name ? '…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {previewName && <BackupPreviewModal name={previewName} onClose={() => setPreviewName(null)} />}
    </div>
  );
}
