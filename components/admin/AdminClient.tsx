'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Edit2, Save, X, Plus, Trash2, Eye, EyeOff, Lock, Upload, Tag } from 'lucide-react';
import { categories } from '@/lib/products';
import type { Product } from '@/lib/products';

type AdminProduct = Product & { _editing?: boolean };

export default function AdminClient() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/admin/products');
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadProducts();
  }, [authenticated, loadProducts]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditData({ ...product });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        await loadProducts();
        setSavedMsg('Saved!');
        setTimeout(() => setSavedMsg(''), 2000);
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm(`Delete product #${id}?`)) return;
    await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
    await loadProducts();
  }

  async function toggleStock(product: Product) {
    await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ inStock: !product.inStock }),
    });
    await loadProducts();
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.id).includes(search) ||
    p.categoryId.includes(search.toLowerCase())
  );

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-24 bg-cream flex items-center justify-center">
        <div className="bg-white border border-bone p-8 w-full max-w-sm">
          <div className="flex items-center justify-center mb-6">
            <Lock size={24} className="text-gold" />
          </div>
          <h1 className="font-display text-2xl font-light text-center mb-6">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-bone px-4 py-3 text-sm outline-none focus:border-gold transition-colors"
                placeholder="Enter admin password"
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
            <button type="submit" className="btn-primary w-full">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-light">Admin Panel</h1>
            <p className="text-xs text-mist mt-1">{products.length} products total</p>
          </div>
          <div className="flex items-center gap-3">
            {savedMsg && (
              <span className="text-xs text-green-600 font-semibold">{savedMsg}</span>
            )}
            <button
              onClick={() => setAuthenticated(false)}
              className="text-xs text-mist hover:text-charcoal border border-bone px-3 py-2"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border border-bone bg-white px-4 py-3 mb-6 max-w-sm">
          <Search size={14} className="text-mist" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID, category..."
            className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-mist hover:text-charcoal">
              <X size={13} />
            </button>
          )}
        </div>
        <p className="text-xs text-mist mb-4">
          Showing {filtered.length} of {products.length} products
        </p>

        {/* Products table */}
        <div className="bg-white border border-bone overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bone bg-cream">
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase w-12">#</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Name</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Price</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase hidden lg:table-cell">Spec</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Status</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider text-mist uppercase">Tags</th>
                  <th className="text-right px-4 py-3 font-semibold tracking-wider text-mist uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  editingId === product.id ? (
                    <tr key={product.id} className="border-b border-bone bg-gold/5">
                      <td className="px-4 py-3 text-mist">{product.id}</td>
                      <td className="px-4 py-3" colSpan={6}>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-mist block mb-1">Name</label>
                              <input
                                value={editData.name || ''}
                                onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                                className="w-full border border-bone px-3 py-2 text-xs outline-none focus:border-gold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-mist block mb-1">Price ($)</label>
                              <input
                                type="number"
                                value={editData.price || 0}
                                onChange={e => setEditData(p => ({ ...p, price: parseFloat(e.target.value) }))}
                                className="w-full border border-bone px-3 py-2 text-xs outline-none focus:border-gold"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-mist block mb-1">Specification</label>
                            <input
                              value={editData.specification || ''}
                              onChange={e => setEditData(p => ({ ...p, specification: e.target.value }))}
                              className="w-full border border-bone px-3 py-2 text-xs outline-none focus:border-gold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-mist block mb-1">Description</label>
                            <textarea
                              value={editData.description || ''}
                              onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                              rows={3}
                              className="w-full border border-bone px-3 py-2 text-xs outline-none focus:border-gold resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editData.isNew || false} onChange={e => setEditData(p => ({ ...p, isNew: e.target.checked }))} />
                              <span className="text-xs">New</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editData.isSale || false} onChange={e => setEditData(p => ({ ...p, isSale: e.target.checked }))} />
                              <span className="text-xs">Sale</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editData.isBestSeller || false} onChange={e => setEditData(p => ({ ...p, isBestSeller: e.target.checked }))} />
                              <span className="text-xs">Best Seller</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editData.inStock ?? true} onChange={e => setEditData(p => ({ ...p, inStock: e.target.checked }))} />
                              <span className="text-xs">In Stock</span>
                            </label>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-mist block mb-1">Image URL</label>
                            <input
                              value={editData.image || ''}
                              onChange={e => setEditData(p => ({ ...p, image: e.target.value }))}
                              className="w-full border border-bone px-3 py-2 text-xs outline-none focus:border-gold"
                              placeholder="/images/products/product-id.jpg"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={saveEdit} disabled={saving} className="btn-gold text-[10px] px-3 py-1.5 flex items-center gap-1">
                            <Save size={11} />
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={cancelEdit} className="text-mist hover:text-charcoal border border-bone px-3 py-1.5 text-[10px]">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={product.id} className="border-b border-bone hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3 text-mist">{product.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-charcoal line-clamp-1 max-w-xs">{product.name}</div>
                      </td>
                      <td className="px-4 py-3 text-mist hidden md:table-cell">
                        {categories.find(c => c.id === product.categoryId)?.name?.substring(0, 20) || product.categoryId}
                      </td>
                      <td className="px-4 py-3 font-semibold text-charcoal">
                        {product.price > 0 ? `$${product.price}` : 'POA'}
                      </td>
                      <td className="px-4 py-3 text-mist hidden lg:table-cell max-w-xs">
                        <span className="line-clamp-1">{product.specification}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStock(product)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 border ${
                            product.inStock ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
                          }`}
                        >
                          {product.inStock ? <Eye size={10} /> : <EyeOff size={10} />}
                          {product.inStock ? 'In Stock' : 'Out'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {product.isNew && <span className="badge-new text-[9px]">N</span>}
                          {product.isSale && <span className="badge-sale text-[9px]">S</span>}
                          {product.isBestSeller && <span className="badge-best text-[9px]">B</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(product)}
                            className="p-1.5 text-mist hover:text-gold border border-transparent hover:border-gold transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="p-1.5 text-mist hover:text-red-500 border border-transparent hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
