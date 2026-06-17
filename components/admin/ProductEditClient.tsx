'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Trash2, ArrowLeft } from 'lucide-react';
import { isAvailableForOrder, type Product, type Category } from '@/lib/products';
import { discountPercent } from '@/lib/fake-discount';

interface Props {
  product?: Product;
  categories: Category[];
  isNew?: boolean;
}

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export default function ProductEditClient({ product, categories, isNew }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    name: '', specification: '', description: '', price: 0, moq: 1,
    categoryId: categories[0]?.id ?? '', tags: [], isNew: false,
    isSale: false, isBestSeller: false, inStock: true, outOfStock: false,
    available_for_order: true, image: '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // For NEW products there's no id yet, so we hold the chosen file and upload it
  // after the product is created (which assigns the id used in the storage path).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  // Raw text of the tags field, shown with '#'. Kept separate from form.tags so
  // typing commas isn't eaten by re-deriving the value from the parsed array.
  const [tagInput, setTagInput] = useState<string>((product?.tags ?? []).map(t => `#${t}`).join(', '));

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  }

  // "Available for order" is the master purchase switch — INDEPENDENT of the
  // real stock count, so customers can preorder a product whose stock is 0. We
  // mirror the legacy `outOfStock` flag as its inverse for backward compatibility.
  function setAvailableForOrder(checked: boolean) {
    setForm(f => ({ ...f, available_for_order: checked, outOfStock: !checked }));
    setIsDirty(true);
  }

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Clean up the object URL used for the new-product local preview.
  useEffect(() => {
    return () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); };
  }, [pendingPreview]);

  function validateImage(file: File): string | null {
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      return `Unsupported file type: ${file.type || 'unknown'}. Use JPG, PNG, WebP, AVIF, or GIF.`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 10MB).`;
    }
    return null;
  }

  async function uploadFile(file: File) {
    setUploadError(null);
    setUploadSuccess(false);
    const err = validateImage(file);
    if (err) { setUploadError(err); return; }

    // New product: no id yet — hold the file and upload after create (on Save).
    if (isNew || !product) {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingFile(file);
      setPendingPreview(URL.createObjectURL(file));
      setIsDirty(true);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/admin/upload-image?id=${product.id}`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(data.detail || data.error || `Upload failed (HTTP ${res.status})`);
      }
      const data: { ok: boolean; url: string } = await res.json();
      update('image', data.url);
      setUploadSuccess(true);
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
      if (isNew) {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Create failed');
        const data = await res.json();
        const newId = data.product.id as number;

        // Now that we have an id, upload the held image and attach its URL.
        if (pendingFile) {
          try {
            const fd = new FormData();
            fd.append('file', pendingFile);
            const up = await fetch(`/api/admin/upload-image?id=${newId}`, { method: 'POST', body: fd });
            if (up.ok) {
              const { url } = await up.json();
              await fetch(`/api/admin/products/${newId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: url }),
              });
            }
          } catch {
            // Product is created; image can be added from the edit screen.
          }
        }
        setIsDirty(false);
        router.push(`/manzura/products/${newId}`);
      } else {
        const res = await fetch(`/api/admin/products/${product!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Save failed');
        setIsDirty(false);
        setUploadSuccess(false);
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
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

  const previewSrc = pendingPreview || form.image || '';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/manzura/products" className="text-mist hover:text-gold transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-light text-charcoal truncate">
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
        {/* Image — shown for both new and existing products */}
        <div>
          <div className="border border-bone bg-white aspect-square flex items-center justify-center mb-3 overflow-hidden">
            {previewSrc
              ? <img src={previewSrc} alt={form.name} className="w-full h-full object-contain" />
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
          {isNew && pendingFile && !uploadError && (
            <p className="text-amber-600 text-xs mt-1 font-semibold">
              Image ready — it uploads when you click Save.
            </p>
          )}
          {!isNew && uploadSuccess && !uploadError && (
            <p className="text-amber-600 text-xs mt-1 font-semibold">
              Upload OK — click Save (top right) to apply to the catalogue.
            </p>
          )}
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
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

            {/* Manual sale control. The "was" price drives the struck-through
                price + −N% badge. 0 / blank = no sale. New products get one
                automatically; here you can override or clear it. */}
            <Field label="Sale — original “was” price ($), 0 = no sale">
              <input
                type="number" step="0.01" min="0"
                value={form.originalPrice ?? 0}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  const val = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
                  update('originalPrice', val);
                  update('isSale', val > (form.price ?? 0));
                }}
                className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
              />
              {(() => {
                const pct = discountPercent(form.price ?? 0, form.originalPrice);
                return pct > 0 ? (
                  <p className="text-[11px] text-gold-dark mt-1">
                    Shows −{pct}% off: ${Number(form.originalPrice).toFixed(2)} → ${Number(form.price ?? 0).toFixed(2)}
                  </p>
                ) : (
                  <p className="text-[11px] text-mist mt-1">No sale shown — enter a price higher than ${Number(form.price ?? 0).toFixed(2)}.</p>
                );
              })()}
            </Field>
            <Field label="Category">
              <select value={form.categoryId ?? ''} onChange={e => update('categoryId', e.target.value)}
                className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            {/* Translatable fields: English + Russian side by side. RU is optional
                and falls back to English on the storefront when empty. */}
            <TranslatableField
              label="Specification" rows={1}
              en={form.specification ?? ''} onEn={v => update('specification', v)}
              ru={form.specification_ru ?? ''} onRu={v => update('specification_ru', v)}
            />
            <TranslatableField
              label="Description" rows={4}
              en={form.description ?? ''} onEn={v => update('description', v)}
              ru={form.description_ru ?? ''} onRu={v => update('description_ru', v)}
            />
            <TranslatableField
              label="Indication" rows={3} placeholder="What this product is indicated for…"
              en={form.indication ?? ''} onEn={v => update('indication', v)}
              ru={form.indication_ru ?? ''} onRu={v => update('indication_ru', v)}
            />
            <TranslatableField
              label="Packaging" rows={2} placeholder="e.g. 1 × 1.0 ml prefilled syringe, 2 × needles…"
              en={form.packaging ?? ''} onEn={v => update('packaging', v)}
              ru={form.packaging_ru ?? ''} onRu={v => update('packaging_ru', v)}
            />
            <TranslatableField
              label="Protocol (shown on product page)" rows={4} placeholder="How to use / treatment protocol…"
              en={form.protocol ?? ''} onEn={v => update('protocol', v)}
              ru={form.protocol_ru ?? ''} onRu={v => update('protocol_ru', v)}
            />

            <Field label="Tags (comma-separated, e.g. #lips, #hyaluronicacid)">
              <input
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value);
                  // Split on commas, strip leading '#', trim — store clean tokens
                  // (the catalogue/chatbot add the '#' back for display/search).
                  update('tags', e.target.value.split(',').map(t => t.trim().replace(/^#+/, '').trim()).filter(Boolean));
                }}
                placeholder="#tag, #tag, #tag"
                className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
              />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {([
                // "New" is automatic (newest 40 products by id) — no manual toggle.
                ['isSale', 'Sale'],
                ['isBestSeller', 'Best Seller'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form[key]} onChange={e => update(key, e.target.checked as Product[typeof key])}
                    className="accent-gold" />
                  <span className="text-xs">{label}</span>
                </label>
              ))}
              {/* Availability — the master order switch, independent of real stock
                  (oversell/preorder is allowed). "Not for sale" is a separate hard block. */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isAvailableForOrder(form)}
                  onChange={e => setAvailableForOrder(e.target.checked)} className="accent-gold" />
                <span className="text-xs">Available for order</span>
              </label>
              <p className="text-[11px] text-mist -mt-1 ml-6">
                Customers can order even when real stock is 0 (shown as “Preorder”). Turn OFF to disable the buy button.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.notForSale}
                  onChange={e => update('notForSale', e.target.checked)} className="accent-gold" />
                <span className="text-xs">Not for sale (purchase disabled)</span>
              </label>
            </div>
          </div>
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

function TranslatableField({
  label, en, onEn, ru, onRu, rows = 1, placeholder,
}: {
  label: string;
  en: string; onEn: (v: string) => void;
  ru: string; onRu: (v: string) => void;
  rows?: number; placeholder?: string;
}) {
  const cls = 'w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-none';
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-mist mb-1.5">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className="block text-[9px] uppercase tracking-[0.15em] text-mist/70 mb-1">English</span>
          {rows > 1
            ? <textarea rows={rows} value={en} onChange={e => onEn(e.target.value)} placeholder={placeholder} className={cls} />
            : <input value={en} onChange={e => onEn(e.target.value)} placeholder={placeholder} className={cls} />}
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-[0.15em] text-mist/70 mb-1">Русский (optional)</span>
          {rows > 1
            ? <textarea rows={rows} value={ru} onChange={e => onRu(e.target.value)} className={cls} />
            : <input value={ru} onChange={e => onRu(e.target.value)} className={cls} />}
        </div>
      </div>
    </div>
  );
}
