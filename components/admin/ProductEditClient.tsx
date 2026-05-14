'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Product, EnrichedInfo, Category } from '@/lib/products';

interface Props {
  product?: Product;
  categories: Category[];
  isNew?: boolean;
}

export default function ProductEditClient({ product, categories, isNew }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    name: '', specification: '', description: '', price: 0, moq: 1,
    categoryId: categories[0]?.id ?? '', tags: [], isNew: false,
    isSale: false, isBestSeller: false, inStock: true, image: '',
  });
  const [enriched, setEnriched] = useState<EnrichedInfo>(product?.enrichedInfo ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'enriched'>('basic');

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  }

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, enrichedInfo: Object.keys(enriched).length ? enriched : undefined };
      if (isNew) {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setIsDirty(false);
        router.push(`/manzura/products/${data.product.id}`);
      } else {
        await fetch(`/api/admin/products/${product!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        setIsDirty(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product || !confirm(`Delete #${product.id} ${product.name}?`)) return;
    setDeleting(true);
    await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
    router.push('/manzura/products');
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/admin/upload-image?id=${product.id}`, { method: 'POST', body: fd });
    const data = await res.json();
    update('image', data.path);
    setUploading(false);
  }

  const tagsStr = (form.tags ?? []).join(', ');

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/manzura/products" className="text-mist hover:text-gold transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-3xl font-light text-charcoal">
            {isNew ? 'New Product' : `#${product?.id} ${product?.name}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-4 py-2 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} className="inline mr-1" />
              Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-gold text-xs flex items-center gap-2 disabled:opacity-60">
            <Save size={13} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image — only shown for existing products */}
        {!isNew && (
          <div>
            <div className="border border-bone bg-white aspect-square flex items-center justify-center mb-3 overflow-hidden">
              {form.image
                ? <img src={form.image} alt={form.name} className="w-full h-full object-contain" />
                : <div className="text-mist text-xs">No image</div>
              }
            </div>
            <label className="btn-secondary w-full text-xs flex items-center justify-center gap-2 cursor-pointer">
              <Upload size={13} />
              {uploading ? 'Uploading…' : 'Replace Image'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        )}

        {/* Form */}
        <div className={isNew ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="flex gap-0 border-b border-bone mb-6">
            {(['basic', 'enriched'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase capitalize border-b-2 -mb-px transition-colors ${
                  activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-mist hover:text-charcoal'
                }`}>
                {tab === 'basic' ? 'Basic Info' : 'Enriched Info'}
              </button>
            ))}
          </div>

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <Field label="Name">
                <input value={form.name ?? ''} onChange={e => update('name', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price ($)">
                  <input type="number" step="0.01" value={form.price ?? 0} onChange={e => update('price', parseFloat(e.target.value))}
                    className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
                </Field>
                <Field label="MOQ (units)">
                  <input type="number" value={form.moq ?? 1} onChange={e => update('moq', parseInt(e.target.value))}
                    className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
                </Field>
              </div>
              <Field label="Category">
                <select value={form.categoryId ?? ''} onChange={e => update('categoryId', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Specification">
                <input value={form.specification ?? ''} onChange={e => update('specification', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Description">
                <textarea rows={4} value={form.description ?? ''} onChange={e => update('description', e.target.value)}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
              <Field label="Tags (comma-separated)">
                <input value={tagsStr} onChange={e => update('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {(['isNew', 'isSale', 'isBestSeller', 'inStock'] as const).map(key => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form[key]} onChange={e => update(key, e.target.checked as any)}
                      className="accent-gold" />
                    <span className="text-xs capitalize">{key.replace('is', '').replace('Best', ' Best ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'enriched' && (
            <div className="space-y-4">
              <Field label="Benefits (one per line)">
                <textarea rows={5} value={(enriched.benefits ?? []).join('\n')}
                  onChange={e => { setEnriched(r => ({ ...r, benefits: e.target.value.split('\n').filter(Boolean) })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
              <Field label="Treatment Areas (comma-separated)">
                <input value={(enriched.treatmentAreas ?? []).join(', ')}
                  onChange={e => { setEnriched(r => ({ ...r, treatmentAreas: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Ingredients">
                <input value={enriched.ingredients ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, ingredients: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Duration">
                <input value={enriched.duration ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, duration: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white" />
              </Field>
              <Field label="Protocol / How to Use">
                <textarea rows={4} value={enriched.protocol ?? ''}
                  onChange={e => { setEnriched(r => ({ ...r, protocol: e.target.value })); setIsDirty(true); }}
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none" />
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-mist mb-1.5">{label}</label>
      {children}
    </div>
  );
}
