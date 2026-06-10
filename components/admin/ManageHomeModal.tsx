'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, ChevronUp, ChevronDown, Trash2, Plus, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/products';
import { saveHomeSection } from '@/app/manzura/products/actions';

// Ordered editor for a home section (전시 = 'featured', Best Sellers =
// 'bestSellers'). Search to add, reorder with up/down, remove, then Save. The
// order shown here is the order shown on the home page.
export default function ManageHomeModal({
  title,
  section,
  products,
  initialIds,
  max,
  onClose,
}: {
  title: string;
  section: 'featured' | 'bestSellers';
  products: Product[];
  initialIds: number[];
  max: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  // Keep only ids that still exist in the catalogue.
  const [ids, setIds] = useState<number[]>(() => initialIds.filter(id => byId.has(id)));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = ids.map(id => byId.get(id)).filter((p): p is Product => !!p);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => !ids.includes(p.id) && `${p.name} ${p.id} ${p.categoryId}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [products, query, ids]);

  function add(id: number) {
    if (ids.includes(id) || ids.length >= max) return;
    setIds([...ids, id]);
  }
  function remove(id: number) {
    setIds(ids.filter(x => x !== id));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  }

  async function save() {
    setSaving(true);
    setError('');
    const res = await saveHomeSection(section, ids);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Save failed'); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bone">
          <div>
            <h2 className="text-base font-semibold text-charcoal">{title}</h2>
            <p className="text-[11px] text-mist mt-0.5">{ids.length}/{max} · shown on the home page in this order</p>
          </div>
          <button onClick={onClose} className="text-mist hover:text-charcoal"><X size={18} /></button>
        </div>

        {/* Search to add */}
        <div className="px-6 py-3 border-b border-bone">
          <div className="flex items-center gap-2 border border-bone rounded-md px-3 py-2 focus-within:border-gold">
            <Search size={14} className="text-mist" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={ids.length >= max ? `Max ${max} reached — remove one to add more` : 'Search a product to add…'}
              disabled={ids.length >= max}
              className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder:text-mist disabled:opacity-60"
            />
            {query && <button onClick={() => setQuery('')} className="text-mist hover:text-charcoal"><X size={14} /></button>}
          </div>
          {results.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto border border-bone rounded-md divide-y divide-bone">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => add(p.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cream/60"
                  >
                    <Plus size={13} className="text-gold shrink-0" />
                    <span className="text-xs font-mono text-mist w-12 shrink-0">#{p.id}</span>
                    <span className="text-sm text-charcoal line-clamp-1">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>

        {/* Ordered selection */}
        <div className="overflow-y-auto px-6 py-3 flex-1">
          {selected.length === 0 ? (
            <p className="text-sm text-mist text-center py-10">Nothing selected — search above to add products.</p>
          ) : (
            <ol className="space-y-1.5">
              {selected.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 py-1.5 px-2 border border-bone rounded-md bg-white">
                  <span className="text-xs font-semibold text-gold-dark w-5 text-center shrink-0">{i + 1}</span>
                  <span className="text-xs font-mono text-mist w-12 shrink-0">#{p.id}</span>
                  <span className="flex-1 text-sm text-charcoal line-clamp-1">{p.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-mist hover:text-charcoal disabled:opacity-30" title="Move up"><ChevronUp size={15} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="p-1 text-mist hover:text-charcoal disabled:opacity-30" title="Move down"><ChevronDown size={15} /></button>
                    <button onClick={() => remove(p.id)} className="p-1 text-mist hover:text-rose-600" title="Remove"><Trash2 size={13} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="px-6 py-3 border-t border-bone flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 border border-bone rounded-full text-mist hover:text-charcoal transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-sm px-5 py-2 bg-gold text-white rounded-full hover:bg-gold-dark disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
