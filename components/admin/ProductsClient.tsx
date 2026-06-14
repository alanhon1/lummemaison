'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Edit2, Trash2, Check, Loader2, LayoutGrid, List } from 'lucide-react';
import Fuse from 'fuse.js';
import type { Product, Category } from '@/lib/products';
import { saveProductStockAction } from '@/app/manzura/products/actions';
import WonderMark from './WonderMark';

interface Props {
  products: Product[];
  categories: Category[];
  stockMap: Record<number, number>;
  wonderIds?: number[];
  unknownIds?: number[];
  initialFilter?: string;
}

const PAGE_SIZE = 50;
const LOW_STOCK_THRESHOLD = 2;

function getPageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const half = 3;
  let start = Math.max(1, current - half);
  let end = Math.min(total, current + half);
  if (end - start < 6) {
    if (start === 1) end = Math.min(total, 7);
    else start = Math.max(1, end - 6);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Click-to-edit stock cell. Owns its own optimistic state — on save success
// the row's stock updates locally without a full page reload, so filtering
// by "low stock" reacts immediately after an edit.
function InlineStockCell({
  productId,
  initial,
  onChange,
}: {
  productId: number;
  initial: number;
  onChange: (next: number) => void;
}) {
  const [stock, setStock] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStock(initial);
    setDraft(String(initial));
  }, [initial]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const parsed = Math.max(0, Math.floor(Number.parseInt(draft, 10) || 0));
    if (parsed === stock) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveProductStockAction(productId, '', parsed);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Save failed');
      return;
    }
    setStock(parsed);
    setEditing(false);
    onChange(parsed);
  }

  function cancel() {
    setDraft(String(stock));
    setEditing(false);
    setError(null);
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          value={draft}
          disabled={saving}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={save}
          className="w-16 border border-gold bg-white px-1.5 py-0.5 text-xs text-charcoal outline-none rounded"
        />
        {saving ? (
          <Loader2 size={12} className="animate-spin text-gold" />
        ) : (
          <button
            type="button"
            onMouseDown={e => e.preventDefault() /* prevent onBlur firing first */}
            onClick={save}
            className="text-gold-dark hover:text-gold p-0.5"
            aria-label="Save"
          >
            <Check size={12} />
          </button>
        )}
        {error && <span className="text-[10px] text-rose-700 ml-1">{error}</span>}
      </div>
    );
  }

  const isOut = stock <= 0;
  const isLow = stock > 0 && stock <= LOW_STOCK_THRESHOLD;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-2 group"
      aria-label={`Edit stock for product ${productId}`}
    >
      {isOut ? (
        <span className="text-[10px] uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
          Sold out
        </span>
      ) : isLow ? (
        <span className="text-sm font-semibold text-rose-700 group-hover:text-rose-900">
          {stock}
        </span>
      ) : (
        <span className="text-sm text-charcoal group-hover:text-gold-dark">{stock}</span>
      )}
      <Edit2 size={10} className="text-mist opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function ProductsClient({ products, categories, stockMap, wonderIds, unknownIds, initialFilter }: Props) {
  const router = useRouter();
  const wonderSet = useMemo(() => new Set(wonderIds ?? []), [wonderIds]);
  const unknownSet = useMemo(() => new Set(unknownIds ?? []), [unknownIds]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [imgFilter, setImgFilter] = useState(initialFilter === 'no-image' ? 'no-image' : '');
  const [stockFilter, setStockFilter] = useState<'all' | 'low-stock' | 'sold-out'>(
    initialFilter === 'low-stock' ? 'low-stock' : initialFilter === 'sold-out' ? 'sold-out' : 'all',
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);
  // Card (grid) vs list (table) view, remembered across reloads. Defaults to
  // list; read from localStorage after mount to avoid an SSR hydration mismatch.
  const [view, setView] = useState<'list' | 'card'>('list');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('manzura:products:view');
      if (saved === 'card' || saved === 'list') setView(saved);
    } catch { /* private mode — ignore */ }
  }, []);
  function changeView(next: 'list' | 'card') {
    setView(next);
    try { localStorage.setItem('manzura:products:view', next); } catch { /* ignore */ }
  }
  // Local overlay on top of the server-rendered stockMap so edits are visible
  // without a page refresh.
  const [stockOverrides, setStockOverrides] = useState<Record<number, number>>({});

  // Bulk "Edit" mode: lets the admin edit name / price / stock for many rows
  // inline on this screen, then Save all / Cancel. Drafts are keyed by product
  // id; productOverrides keeps saved name/price visible without a full reload.
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { name: string; price: string; stock: string }>>({});
  const [productOverrides, setProductOverrides] = useState<Record<number, { name?: string; price?: number }>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bulk action state
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPriceMode, setBulkPriceMode] = useState<'%' | 'fixed'>('%');
  const [bulkCategory, setBulkCategory] = useState('');

  function effectiveStock(id: number): number {
    if (stockOverrides[id] !== undefined) return stockOverrides[id];
    return stockMap[id] ?? 0;
  }

  // Name / price reflecting any locally-saved overrides (so the table updates
  // after a bulk save without a page reload).
  function nameOf(p: Product): string {
    return productOverrides[p.id]?.name ?? p.name;
  }
  function priceOf(p: Product): number {
    return productOverrides[p.id]?.price ?? p.price;
  }

  function updateDraft(p: Product, field: 'name' | 'price' | 'stock', value: string) {
    setDrafts(prev => {
      const cur = prev[p.id] ?? {
        name: nameOf(p),
        price: String(priceOf(p)),
        stock: String(effectiveStock(p.id)),
      };
      return { ...prev, [p.id]: { ...cur, [field]: value } };
    });
  }

  function draftVal(p: Product, field: 'name' | 'price' | 'stock'): string {
    const d = drafts[p.id];
    if (d) return d[field];
    if (field === 'name') return nameOf(p);
    if (field === 'price') return String(priceOf(p));
    return String(effectiveStock(p.id));
  }

  function cancelEdit() {
    setEditMode(false);
    setDrafts({});
    setSaveError(null);
  }

  async function handleSaveAll() {
    setSavingAll(true);
    setSaveError(null);
    const ids = Object.keys(drafts).map(Number);
    for (const id of ids) {
      const d = drafts[id];
      const p = products.find(x => x.id === id);
      if (!p) continue;

      // Name / price → PATCH the product JSON (only changed fields).
      const patch: { name?: string; price?: number } = {};
      const newName = d.name.trim();
      if (newName && newName !== nameOf(p)) patch.name = newName;
      const newPrice = parseFloat(d.price);
      if (Number.isFinite(newPrice) && newPrice >= 0 && newPrice !== priceOf(p)) patch.price = newPrice;
      if (Object.keys(patch).length > 0) {
        const res = await fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          setSaveError(`Failed to save product #${id}.`);
          setSavingAll(false);
          return;
        }
        setProductOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
      }

      // Stock → dedicated server action.
      const newStock = Math.max(0, Math.floor(Number.parseInt(d.stock, 10) || 0));
      if (newStock !== effectiveStock(id)) {
        const res = await saveProductStockAction(id, '', newStock);
        if (!res.ok) {
          setSaveError(res.error ?? `Failed to save stock for #${id}.`);
          setSavingAll(false);
          return;
        }
        setStockOverrides(prev => ({ ...prev, [id]: newStock }));
      }
    }
    setSavingAll(false);
    setEditMode(false);
    setDrafts({});
    // Re-pull server data so the search index + base props reflect the saved
    // names/prices (the optimistic overrides keep the table correct meanwhile).
    router.refresh();
  }

  const fuse = useMemo(
    () =>
      new Fuse(products, {
        keys: ['name', 'id', 'categoryId'],
        threshold: 0.4,
      }),
    [products],
  );

  const filtered = useMemo(() => {
    let list: Product[] = search ? fuse.search(search).map(r => r.item) : products;
    if (catFilter) list = list.filter(p => p.categoryId === catFilter);
    if (imgFilter === 'no-image') list = list.filter(p => !p.image);
    if (imgFilter === 'has-image') list = list.filter(p => !!p.image);
    if (stockFilter === 'low-stock') {
      list = list.filter(p => effectiveStock(p.id) <= LOW_STOCK_THRESHOLD);
    } else if (stockFilter === 'sold-out') {
      list = list.filter(p => effectiveStock(p.id) <= 0);
    }
    return list;
    // effectiveStock is read inside; intentionally depend on stockOverrides + stockMap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, catFilter, imgFilter, stockFilter, fuse, stockOverrides, stockMap]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id: number) {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this product?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(null);
    }
  }

  function handleBulkPriceApply() {
    // TODO: implement when /api/admin/products bulk API is available
    console.log('bulk price apply', [...selected], bulkPriceValue, bulkPriceMode);
  }

  function handleBulkCategoryApply() {
    // TODO: implement when /api/admin/products bulk API is available
    console.log('bulk category change', { ids: [...selected], category: bulkCategory });
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} selected product${selected.size > 1 ? 's' : ''}?`)) return;
    // TODO: implement when /api/admin/products bulk API is available
    console.log('bulk delete', [...selected]);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Products</h1>
        <div className="flex gap-3 items-center">
          {/* View toggle: list (table) ↔ card (grid). Hidden during bulk edit,
              which is inherently table-shaped. */}
          {!editMode && (
            <div className="flex border border-bone rounded-sm overflow-hidden">
              <button
                onClick={() => changeView('list')}
                aria-label="List view"
                className={`p-1.5 transition-colors ${view === 'list' ? 'bg-obsidian text-cream' : 'text-mist hover:text-charcoal'}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => changeView('card')}
                aria-label="Card view"
                className={`p-1.5 transition-colors ${view === 'card' ? 'bg-obsidian text-cream' : 'text-mist hover:text-charcoal'}`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
          {editMode ? (
            <>
              {saveError && <span className="text-xs text-rose-700">{saveError}</span>}
              <button
                onClick={handleSaveAll}
                disabled={savingAll}
                className="btn-gold text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {savingAll ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {savingAll ? 'Saving…' : 'Save all'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={savingAll}
                className="text-xs text-mist hover:text-charcoal border border-bone px-3 py-1.5 disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs text-charcoal border border-gold/50 hover:border-gold hover:text-gold-dark px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
            >
              <Edit2 size={13} />
              Edit
            </button>
          )}
          <Link href="/manzura/products/new" className="btn-gold text-xs">+ New Product</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 border border-bone bg-white px-3 py-2 flex-1 min-w-48">
          <Search size={13} className="text-mist" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, ID, category…"
            className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={12} className="text-mist" />
            </button>
          )}
        </div>
        <select
          value={catFilter}
          onChange={e => {
            setCatFilter(e.target.value);
            setPage(1);
          }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={e => {
            setStockFilter(e.target.value as 'all' | 'low-stock' | 'sold-out');
            setPage(1);
          }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="all">All Stock</option>
          <option value="low-stock">Low / Out (≤ {LOW_STOCK_THRESHOLD})</option>
          <option value="sold-out">Sold out only</option>
        </select>
        <select
          value={imgFilter}
          onChange={e => {
            setImgFilter(e.target.value);
            setPage(1);
          }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Images</option>
          <option value="has-image">Has Image</option>
          <option value="no-image">No Image</option>
        </select>
      </div>

      <p className="text-xs text-mist mb-3">
        Showing {filtered.length} of {products.length} products
      </p>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="bg-cream border border-gold/20 rounded-sm p-3 flex flex-wrap gap-4 items-center mb-4">
          <span className="text-sm font-medium">
            {selected.size} item{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={bulkPriceValue}
              onChange={e => setBulkPriceValue(e.target.value)}
              placeholder="Amount"
              className="border border-bone bg-white px-2 py-1 text-xs w-20 outline-none focus:border-gold"
            />
            <button
              onClick={() => setBulkPriceMode(m => (m === '%' ? 'fixed' : '%'))}
              className="border border-bone bg-white px-2 py-1 text-xs text-charcoal hover:border-gold transition-colors"
            >
              {bulkPriceMode}
            </button>
            <button
              onClick={handleBulkPriceApply}
              className="text-xs border border-bone px-3 py-1 hover:border-gold hover:text-gold transition-colors"
            >
              Apply Price
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
              className="border border-bone bg-white px-2 py-1 text-xs text-charcoal outline-none focus:border-gold"
            >
              <option value="">Select category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkCategoryApply}
              className="text-xs border border-bone px-3 py-1 hover:border-gold hover:text-gold transition-colors"
            >
              Apply Category
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            className="text-xs border border-red-200 text-red-500 px-3 py-1 hover:border-red-400 hover:text-red-700 transition-colors ml-auto"
          >
            <Trash2 size={11} className="inline mr-1" />
            Delete Selected
          </button>
        </div>
      )}

      {view === 'card' && !editMode ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {paged.map(product => (
            <div key={product.id} className="bg-white border border-bone rounded-sm p-3 relative flex flex-col">
              <input
                type="checkbox"
                checked={selected.has(product.id)}
                onChange={() => toggleSelect(product.id)}
                className="absolute top-2 left-2 z-10 accent-gold"
              />
              <Link href={`/manzura/products/${product.id}`} className="block">
                <div className="aspect-square bg-cream border border-bone mb-2 flex items-center justify-center overflow-hidden rounded-sm">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-mist">No image</span>
                  )}
                </div>
              </Link>
              <p className="text-[10px] text-mist">#{product.id}</p>
              <Link
                href={`/manzura/products/${product.id}`}
                className="text-xs font-medium text-charcoal line-clamp-2 mb-2 hover:text-gold-dark transition-colors"
              >
                <span className="inline-flex items-center gap-1">
                  {nameOf(product)}
                  {wonderSet.has(product.id) && <WonderMark />}
                </span>
              </Link>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-xs font-semibold text-charcoal">
                  {priceOf(product) > 0 ? `$${priceOf(product)}` : 'POA'}
                </span>
                {unknownSet.has(product.id) ? (
                  <span className="text-purple-700 font-semibold text-xs" title="Unknown — set the real stock">???</span>
                ) : (
                  <InlineStockCell
                    productId={product.id}
                    initial={effectiveStock(product.id)}
                    onChange={next => setStockOverrides(prev => ({ ...prev, [product.id]: next }))}
                  />
                )}
              </div>
              <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-bone">
                <Link
                  href={`/manzura/products/${product.id}`}
                  className="p-1.5 text-mist hover:text-gold border border-transparent hover:border-gold transition-colors"
                >
                  <Edit2 size={13} />
                </Link>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={deleting === product.id}
                  className="p-1.5 text-mist hover:text-red-500 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="bg-white border border-bone overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bone bg-cream">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && paged.every(p => selected.has(p.id))}
                    onChange={e => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) paged.forEach(p => next.add(p.id));
                        else paged.forEach(p => next.delete(p.id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-12">#</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-10">Img</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Name</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Price</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Stock</th>
                <th className="text-right px-4 py-3 font-semibold tracking-wider text-mist uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(product => (
                <tr key={product.id} className="border-b border-bone hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-mist">{product.id}</td>
                  <td className="px-4 py-3">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt="" className="w-10 h-10 object-contain border border-bone" />
                    ) : (
                      <div className="w-10 h-10 bg-cream border border-bone flex items-center justify-center text-[8px] text-mist">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal max-w-xs">
                    {editMode ? (
                      <input
                        value={draftVal(product, 'name')}
                        onChange={e => updateDraft(product, 'name', e.target.value)}
                        className="w-full border border-gold/60 bg-white px-2 py-1 text-xs text-charcoal outline-none focus:border-gold rounded"
                      />
                    ) : (
                      <span className="line-clamp-1 inline-flex items-center gap-1">
                        {nameOf(product)}
                        {wonderSet.has(product.id) && <WonderMark />}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-charcoal">
                    {editMode ? (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-mist">$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draftVal(product, 'price')}
                          onChange={e => updateDraft(product, 'price', e.target.value)}
                          className="w-20 border border-gold/60 bg-white px-1.5 py-1 text-xs text-charcoal outline-none focus:border-gold rounded"
                        />
                      </div>
                    ) : priceOf(product) > 0 ? (
                      `$${priceOf(product)}`
                    ) : (
                      'POA'
                    )}
                  </td>
                  <td className="px-4 py-3 text-mist hidden md:table-cell">{product.categoryId}</td>
                  <td className="px-4 py-3">
                    {editMode ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draftVal(product, 'stock')}
                        onChange={e => updateDraft(product, 'stock', e.target.value)}
                        className="w-16 border border-gold/60 bg-white px-1.5 py-1 text-xs text-charcoal outline-none focus:border-gold rounded"
                      />
                    ) : unknownSet.has(product.id) ? (
                      <span className="text-purple-700 font-semibold" title="Unknown — set the real stock">???</span>
                    ) : (
                      <InlineStockCell
                        productId={product.id}
                        initial={effectiveStock(product.id)}
                        onChange={next =>
                          setStockOverrides(prev => ({ ...prev, [product.id]: next }))
                        }
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        href={`/manzura/products/${product.id}`}
                        className="p-1.5 text-mist hover:text-gold border border-transparent hover:border-gold transition-colors"
                      >
                        <Edit2 size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleting === product.id}
                        className="p-1.5 text-mist hover:text-red-500 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40"
          >
            ←
          </button>
          {getPageNumbers(page, totalPages).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-1.5 border text-xs ${
                n === page ? 'border-gold text-gold' : 'border-bone text-mist'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
