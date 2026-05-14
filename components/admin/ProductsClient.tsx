'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Search, X, Edit2, Trash2 } from 'lucide-react';
import Fuse from 'fuse.js';
import type { Product, Category } from '@/lib/products';

interface Props {
  products: Product[];
  categories: Category[];
  initialFilter?: string;
}

const PAGE_SIZE = 50;

export default function ProductsClient({ products, categories, initialFilter }: Props) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [imgFilter, setImgFilter] = useState(initialFilter === 'no-image' ? 'no-image' : '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);

  // Bulk action state
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPriceMode, setBulkPriceMode] = useState<'%' | 'fixed'>('%');
  const [bulkCategory, setBulkCategory] = useState('');

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['name', 'id', 'categoryId'],
    threshold: 0.4,
  }), [products]);

  const filtered = useMemo(() => {
    let list: Product[] = search
      ? fuse.search(search).map(r => r.item)
      : products;
    if (catFilter) list = list.filter(p => p.categoryId === catFilter);
    if (imgFilter === 'no-image') list = list.filter(p => !p.image);
    if (imgFilter === 'has-image') list = list.filter(p => !!p.image);
    return list;
  }, [products, search, catFilter, imgFilter, fuse]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleDelete(id: number) {
    if (!confirm(`Delete product #${id}?`)) return;
    setDeleting(id);
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    setDeleting(null);
    window.location.reload();
  }

  function handleBulkPriceApply() {
    console.log('bulk price adjust', { ids: [...selected], value: bulkPriceValue, mode: bulkPriceMode });
  }

  function handleBulkCategoryApply() {
    console.log('bulk category change', { ids: [...selected], category: bulkCategory });
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} selected product${selected.size > 1 ? 's' : ''}?`)) return;
    console.log('bulk delete', [...selected]);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-light text-charcoal">Products</h1>
        <div className="flex gap-3">
          <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2">← Dashboard</Link>
          <Link href="/manzura/products/new" className="btn-gold text-xs">+ New Product</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 border border-bone bg-white px-3 py-2 flex-1 min-w-48">
          <Search size={13} className="text-mist" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, ID, category..."
            className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
          />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-mist" /></button>}
        </div>
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={imgFilter}
          onChange={e => { setImgFilter(e.target.value); setPage(1); }}
          className="border border-bone bg-white px-3 py-2 text-xs text-charcoal outline-none"
        >
          <option value="">All Images</option>
          <option value="has-image">Has Image</option>
          <option value="no-image">No Image</option>
        </select>
      </div>

      <p className="text-xs text-mist mb-3">Showing {filtered.length} of {products.length} products</p>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="bg-cream border border-gold/20 rounded-sm p-3 flex flex-wrap gap-4 items-center mb-4">
          <span className="text-sm font-medium">{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>

          {/* Price adjustment */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={bulkPriceValue}
              onChange={e => setBulkPriceValue(e.target.value)}
              placeholder="Amount"
              className="border border-bone bg-white px-2 py-1 text-xs w-20 outline-none focus:border-gold"
            />
            <button
              onClick={() => setBulkPriceMode(m => m === '%' ? 'fixed' : '%')}
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

          {/* Category change */}
          <div className="flex items-center gap-2">
            <select
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
              className="border border-bone bg-white px-2 py-1 text-xs text-charcoal outline-none focus:border-gold"
            >
              <option value="">Select category…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={handleBulkCategoryApply}
              className="text-xs border border-bone px-3 py-1 hover:border-gold hover:text-gold transition-colors"
            >
              Apply Category
            </button>
          </div>

          {/* Delete selected */}
          <button
            onClick={handleBulkDelete}
            className="text-xs border border-red-200 text-red-500 px-3 py-1 hover:border-red-400 hover:text-red-700 transition-colors ml-auto"
          >
            <Trash2 size={11} className="inline mr-1" />
            Delete Selected
          </button>
        </div>
      )}

      <div className="bg-white border border-bone overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bone bg-cream">
                <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(paged.map(p => p.id)) : new Set())} /></th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-12">#</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-10">Img</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Name</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Price</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Status</th>
                <th className="text-right px-4 py-3 font-semibold tracking-wider text-mist uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(product => (
                <tr key={product.id} className="border-b border-bone hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelect(product.id)} /></td>
                  <td className="px-4 py-3 text-mist">{product.id}</td>
                  <td className="px-4 py-3">
                    {product.image
                      ? <img src={product.image} alt="" className="w-10 h-10 object-contain border border-bone" />
                      : <div className="w-10 h-10 bg-cream border border-bone flex items-center justify-center text-[8px] text-mist">—</div>
                    }
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal max-w-xs">
                    <span className="line-clamp-1">{product.name}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-charcoal">{product.price > 0 ? `$${product.price}` : 'POA'}</td>
                  <td className="px-4 py-3 text-mist hidden md:table-cell">{product.categoryId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 border ${product.inStock ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
                      {product.inStock ? 'In Stock' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/manzura/products/${product.id}`} className="p-1.5 text-mist hover:text-gold border border-transparent hover:border-gold transition-colors">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40">←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} className={`px-3 py-1.5 border text-xs ${n === page ? 'border-gold text-gold' : 'border-bone text-mist'}`}>{n}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-bone text-xs disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}
