'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Product, EnrichedInfo, Category } from '@/lib/products';

interface Props {
  product?: Product;
  categories: Category[];
  isNew?: boolean;
}

interface LanguageNames {
  nameEn: string;
  nameRu: string;
  nameKo: string;
}

export default function ProductEditClient({ product, categories, isNew }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    name: '', specification: '', description: '', price: 0, moq: 1,
    categoryId: categories[0]?.id ?? '', tags: [], isNew: false,
    isSale: false, isBestSeller: false, inStock: true, image: '',
  });
  const [enriched, setEnriched] = useState<EnrichedInfo>(product?.enrichedInfo ?? {});
  const [langNames, setLangNames] = useState<LanguageNames>({ nameEn: '', nameRu: '', nameKo: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'enriched' | 'languages'>('basic');

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

  async function uploadFile(file: File) {
    if (!product) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/upload-image?id=${product.id}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data: { ok: boolean; path: string } = await res.json();
      update('image', `${data.path}?v=${Date.now()}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        ...form,
        enrichedInfo: Object.keys(enriched).length ? enriched : undefined,
        nameEn: langNames.nameEn || undefined,
        nameRu: langNames.nameRu || undefined,
        nameKo: langNames.nameKo || undefined,
      };
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
        try {
          const res = await fetch(`/api/admin/products/${product!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error('Save failed');
          setIsDirty(false);
          router.refresh();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Save failed');
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/manzura/products');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const tagsStr = (form.tags ?? []).join(', ');

  function tabClass(tab: 'basic' | 'enriched' | 'languages') {
    return `px-5 py-3 text-xs font-semibold tracking-wider uppercase capitalize border-b-2 -mb-px transition-colors ${
      activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-mist hover:text-charcoal'
    }`;
  }

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
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-gold/40 text-espresso text-xs px-3 py-1.5 rounded-sm hover:border-gold transition-colors"
          >
            Cancel
          </button>
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
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-gold bg-gold/5' : 'border-bone hover:border-gold/50'}`}
            >
              <p className="text-sm text-stone-500">
                {uploading ? 'Uploading…' : 'Drag & drop or click to upload'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {uploadError && <p className="text-red-600 text-xs mt-1">{uploadError}</p>}
          </div>
        )}

        {/* Form */}
        <div className={isNew ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="flex gap-0 border-b border-bone mb-6">
            <button onClick={() => setActiveTab('basic')} className={tabClass('basic')}>Basic Info</button>
            <button onClick={() => setActiveTab('enriched')} className={tabClass('enriched')}>Enriched Info</button>
            <button onClick={() => setActiveTab('languages')} className={tabClass('languages')}>Languages</button>
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
                    <input type="checkbox" checked={!!form[key]} onChange={e => update(key, e.target.checked as Product[typeof key])}
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

          {activeTab === 'languages' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500">Category language names (for display in storefront)</p>
              <Field label="English">
                <input
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
                  value={langNames.nameEn}
                  onChange={e => { setLangNames(l => ({ ...l, nameEn: e.target.value })); setIsDirty(true); }}
                />
              </Field>
              <Field label="Russian (RU)">
                <input
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
                  value={langNames.nameRu}
                  onChange={e => { setLangNames(l => ({ ...l, nameRu: e.target.value })); setIsDirty(true); }}
                />
              </Field>
              <Field label="Korean (KO)">
                <input
                  className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
                  value={langNames.nameKo}
                  onChange={e => { setLangNames(l => ({ ...l, nameKo: e.target.value })); setIsDirty(true); }}
                />
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
