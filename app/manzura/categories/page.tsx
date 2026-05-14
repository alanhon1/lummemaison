'use client';

// Note: this is a simple client page; categories edits are done inline
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { categories as initialCategories, Category } from '@/lib/products';

export default function CategoriesPage() {
  const [cats, setCats] = useState(initialCategories);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(id: string, name: string) {
    setSaving(id);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Categories</h1>
        <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
      </div>
      <div className="bg-white border border-bone">
        {cats.map(cat => (
          <CategoryRow key={cat.id} cat={cat} saving={saving === cat.id} onSave={name => handleSave(cat.id, name)} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ cat, saving, onSave }: { cat: Category; saving: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    setName(cat.name);
  }, [cat.id]);

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-bone last:border-0">
      <span className="text-xs text-mist w-32 shrink-0">{cat.id}</span>
      <input
        aria-label={`Category name for ${cat.id}`}
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 border border-bone px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      <span className="text-xs text-mist w-20 text-right">#{cat.range[0]}–{cat.range[1]}</span>
      <button
        onClick={() => onSave(name)}
        disabled={saving || name === cat.name}
        className="btn-gold text-[10px] px-3 py-1.5 disabled:opacity-40"
      >
        {saving ? '…' : 'Save'}
      </button>
    </div>
  );
}
