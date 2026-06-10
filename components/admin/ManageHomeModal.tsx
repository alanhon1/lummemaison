'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, Star, Sparkles, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/products';

// Manage which products appear in the home page's Best Sellers / New Arrivals
// rows. Toggles flip the product's isBestSeller / isNew flag in the live
// catalogue via the existing PATCH route (which revalidates the home page).
export default function ManageHomeModal({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [flags, setFlags] = useState<Record<number, { best: boolean; isNew: boolean }>>(
    () => Object.fromEntries(products.map(p => [p.id, { best: !!p.isBestSeller, isNew: !!p.isNew }])),
  );
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const bestCount = useMemo(() => Object.values(flags).filter(f => f.best).length, [flags]);
  const newCount = useMemo(() => Object.values(flags).filter(f => f.isNew).length, [flags]);

  // No search → show only currently-selected products. Searching → show matches.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.filter(p => flags[p.id]?.best || flags[p.id]?.isNew);
    return products
      .filter(p => `${p.name} ${p.id} ${p.categoryId}`.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, query, flags]);

  async function toggle(id: number, field: 'best' | 'isNew') {
    const key = `${id}:${field}`;
    const next = !flags[id][field];
    setSaving(prev => new Set(prev).add(key));
    setError('');
    try {
      const apiField = field === 'best' ? 'isBestSeller' : 'isNew';
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [apiField]: next }),
      });
      if (!res.ok) throw new Error('Save failed');
      setFlags(prev => ({ ...prev, [id]: { ...prev[id], [field]: next } }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  const pill = (active: boolean) =>
    `text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
      active ? 'bg-gold text-white border-gold' : 'text-mist border-bone hover:border-gold hover:text-gold-dark'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bone">
          <div>
            <h2 className="text-base font-semibold text-charcoal">Manage home sections</h2>
            <p className="text-[11px] text-mist mt-0.5">
              Best Sellers: {bestCount} · New Arrivals: {newCount}
            </p>
          </div>
          <button onClick={onClose} className="text-mist hover:text-charcoal"><X size={18} /></button>
        </div>

        <div className="px-6 py-3 border-b border-bone">
          <div className="flex items-center gap-2 border border-bone rounded-md px-3 py-2 focus-within:border-gold">
            <Search size={14} className="text-mist" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search a product to add (name, ID, category)…"
              className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder:text-mist"
            />
            {query && <button onClick={() => setQuery('')} className="text-mist hover:text-charcoal"><X size={14} /></button>}
          </div>
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>

        <div className="overflow-y-auto px-6 py-3">
          {visible.length === 0 ? (
            <p className="text-sm text-mist text-center py-10">
              {query ? 'No matching products.' : 'Nothing selected yet — search above to add products.'}
            </p>
          ) : (
            <ul className="divide-y divide-bone">
              {visible.map(p => {
                const f = flags[p.id];
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-xs font-mono text-mist w-12 shrink-0">#{p.id}</span>
                    <span className="flex-1 text-sm text-charcoal line-clamp-1">{p.name}</span>
                    <button onClick={() => toggle(p.id, 'best')} disabled={saving.has(`${p.id}:best`)} className={pill(f.best)}>
                      {saving.has(`${p.id}:best`) ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
                      Best
                    </button>
                    <button onClick={() => toggle(p.id, 'isNew')} disabled={saving.has(`${p.id}:isNew`)} className={pill(f.isNew)}>
                      {saving.has(`${p.id}:isNew`) ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      New
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 border-t border-bone flex justify-end">
          <button onClick={onClose} className="text-sm px-5 py-2 bg-charcoal text-cream rounded-full hover:bg-charcoal/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
