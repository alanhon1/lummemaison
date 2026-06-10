'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { categories } from '@/lib/products';

interface PreviewProduct {
  id: number;
  name: string;
  price: number;
  categoryId: string;
}

const CATEGORY_NAME = new Map(categories.map(c => [c.id, c.name]));

export default function BackupPreviewModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [rows, setRows] = useState<PreviewProduct[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/backup?preview=${encodeURIComponent(name)}`)
      .then(async r => {
        if (!r.ok) throw new Error('Failed to load preview');
        return r.json();
      })
      .then(d => { if (active) setRows((d.products ?? []) as PreviewProduct[]); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Failed to load preview'); });
    return () => { active = false; };
  }, [name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-bone rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="bg-white border-b border-bone px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-light text-charcoal">Backup preview</h2>
            <p className="text-xs text-mist mt-0.5 break-all">
              {name}{rows ? ` · ${rows.length} products` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-mist hover:text-charcoal flex-shrink-0 ml-3">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!rows && !error && <p className="text-sm text-mist">Loading…</p>}
          {rows && (
            <table className="w-full text-sm border border-bone">
              <thead className="bg-cream">
                <tr className="text-[10px] uppercase tracking-widest text-mist">
                  <th className="text-left px-3 py-2 font-semibold">ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Name</th>
                  <th className="text-right px-3 py-2 font-semibold">Price</th>
                  <th className="text-left px-3 py-2 font-semibold">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id} className={`border-t border-bone ${i % 2 ? 'bg-cream/30' : ''}`}>
                    <td className="px-3 py-1.5 font-mono text-mist whitespace-nowrap">#{p.id}</td>
                    <td className="px-3 py-1.5 text-charcoal">{p.name}</td>
                    <td className="px-3 py-1.5 text-right text-charcoal whitespace-nowrap">${p.price}</td>
                    <td className="px-3 py-1.5 text-mist">{CATEGORY_NAME.get(p.categoryId) ?? p.categoryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
