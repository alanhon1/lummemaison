'use client';

import { useState } from 'react';
import { X, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface StockRow {
  id: number;
  name: unknown;
  stock: number;
}

interface Props {
  rows: StockRow[];
  outOfStock: number;
  lowStock: number;
}

export default function StockOverviewPanel({ rows, outOfStock, lowStock }: Props) {
  const [open, setOpen] = useState(false);

  const totalProducts = rows.length;
  const totalUnits = rows.reduce((s, r) => s + r.stock, 0);
  const okCount = totalProducts - outOfStock - lowStock;

  // Top 10 by stock level
  const topByStock = [...rows]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 10)
    .map(r => ({
      name: (r.name as string).length > 22 ? (r.name as string).slice(0, 20) + '…' : (r.name as string),
      stock: r.stock,
    }));

  // Bottom 10 (lowest stock, excluding zero)
  const lowRows = [...rows]
    .filter(r => r.stock > 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map(r => ({
      name: (r.name as string).length > 22 ? (r.name as string).slice(0, 20) + '…' : (r.name as string),
      stock: r.stock,
    }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-3 py-2 rounded transition-colors"
      >
        <BarChart2 size={12} />
        Overview
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative ml-auto bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl border-l border-bone">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-bone px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-xl font-light text-charcoal">Stock Overview</h2>
              <button onClick={() => setOpen(false)} className="text-mist hover:text-charcoal">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Products</p>
                  <p className="text-xl font-semibold text-charcoal">{totalProducts}</p>
                </div>
                <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Total Units</p>
                  <p className="text-xl font-semibold text-charcoal">{totalUnits.toLocaleString()}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-rose-500 mb-1">Sold Out</p>
                  <p className="text-xl font-semibold text-rose-600">{outOfStock}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-amber-600 mb-1">Low (≤3)</p>
                  <p className="text-xl font-semibold text-amber-700">{lowStock}</p>
                </div>
              </div>

              {/* Status distribution */}
              <div className="bg-white border border-bone rounded p-4">
                <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Stock Health</p>
                <div className="flex gap-2 h-4 rounded overflow-hidden">
                  {okCount > 0 && (
                    <div
                      className="bg-emerald-400 rounded-l"
                      style={{ flex: okCount }}
                      title={`OK: ${okCount}`}
                    />
                  )}
                  {lowStock > 0 && (
                    <div
                      className="bg-amber-400"
                      style={{ flex: lowStock }}
                      title={`Low: ${lowStock}`}
                    />
                  )}
                  {outOfStock > 0 && (
                    <div
                      className="bg-rose-400 rounded-r"
                      style={{ flex: outOfStock }}
                      title={`Sold out: ${outOfStock}`}
                    />
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-mist">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> OK ({okCount})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Low ({lowStock})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Sold Out ({outOfStock})</span>
                </div>
              </div>

              {/* Top stock levels */}
              {topByStock.length > 0 && (
                <div className="bg-white border border-bone rounded p-4">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Top 10 by Stock Level</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topByStock} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e8e2d9', borderRadius: 4 }} />
                      <Bar dataKey="stock" fill="#c9a96e" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Lowest stock */}
              {lowRows.length > 0 && (
                <div className="bg-white border border-bone rounded p-4">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Lowest Stock (non-zero)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={lowRows} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e8e2d9', borderRadius: 4 }} />
                      <Bar dataKey="stock" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* All products table */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-mist mb-3">All Products</p>
                <div className="border border-bone rounded overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-cream border-b border-bone sticky top-0">
                      <tr className="text-[9px] uppercase tracking-widest text-mist">
                        <th className="text-left px-3 py-2 font-semibold">ID</th>
                        <th className="text-left px-3 py-2 font-semibold">Product</th>
                        <th className="text-right px-3 py-2 font-semibold">Stock</th>
                        <th className="text-left px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rows]
                        .sort((a, b) => a.stock - b.stock)
                        .map((r, i) => {
                          const isOut = r.stock <= 0;
                          const isLow = !isOut && r.stock <= 3;
                          return (
                            <tr key={r.id} className={`border-t border-bone ${i % 2 === 1 ? 'bg-cream/30' : ''} ${isOut ? 'bg-rose-50/40' : isLow ? 'bg-amber-50/40' : ''}`}>
                              <td className="px-3 py-2 font-mono text-mist">#{r.id}</td>
                              <td className="px-3 py-2 text-charcoal">{r.name as string}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-charcoal'}`}>
                                {r.stock}
                              </td>
                              <td className="px-3 py-2">
                                {isOut ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Sold out</span>
                                ) : isLow ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Low</span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
