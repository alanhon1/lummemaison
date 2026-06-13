'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  email_verified: boolean;
  phone: string;
  customer_code: string | null;
  city: string;
  country: string;
  created_at: string;
  order_count: number;
  total_spent_cents: number;
}

type SearchMode = 'code' | 'name';
const PAGE_SIZE = 20;

// Format total cents as USD (orders are all USD for this store)
function formatTotal(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function UsersClient({ rows }: { rows: UserRow[] }) {
  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Masked input handler for Customer ID: pos 0-3 = digits, pos 4-7 = uppercase letters
  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (allowed.includes(e.key)) return;
    const pos = (e.target as HTMLInputElement).selectionStart ?? 0;
    const cur = (e.target as HTMLInputElement).value;
    if (cur.length >= 8) { e.preventDefault(); return; }
    if (pos < 4 && !/\d/.test(e.key)) { e.preventDefault(); return; }
    if (pos >= 4 && !/[a-zA-Z]/.test(e.key)) { e.preventDefault(); return; }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    setQuery(raw.slice(0, 8));
    setPage(1);
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setPage(1);
  }

  function switchMode(mode: SearchMode) {
    setSearchMode(mode);
    setQuery('');
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    if (searchMode === 'code') {
      return rows.filter(r => r.customer_code === q);
    }
    const ql = q.toLowerCase();
    return rows.filter(
      r =>
        r.full_name.toLowerCase().includes(ql) ||
        r.email.toLowerCase().includes(ql),
    );
  }, [rows, query, searchMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const unverifiedCount = rows.filter(r => !r.email_verified).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Users</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">
            {rows.length} customer{rows.length !== 1 ? 's' : ''}
            {unverifiedCount > 0 && (
              <span className="text-amber-600"> · {unverifiedCount} email{unverifiedCount !== 1 ? 's' : ''} not confirmed</span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['name', 'code'] as SearchMode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`text-xs uppercase tracking-widest px-4 py-1.5 rounded-full border transition-colors ${
                searchMode === m
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
              }`}
            >
              {m === 'name' ? 'Name / Email' : 'Customer ID'}
            </button>
          ))}
        </div>

        {searchMode === 'code' ? (
          <div className="flex items-center gap-2 max-w-xs">
            <input
              type="text"
              value={query}
              onChange={handleCodeChange}
              onKeyDown={handleCodeKeyDown}
              maxLength={8}
              placeholder="e.g. 4821KQXM"
              className="w-full border border-bone bg-white px-3 py-2 text-sm font-mono text-charcoal outline-none focus:border-gold transition-colors rounded-sm tracking-widest placeholder-mist"
            />
            {query && (
              <button onClick={() => { setQuery(''); setPage(1); }} className="text-xs text-mist hover:text-charcoal">
                Clear
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              value={query}
              onChange={handleNameChange}
              placeholder="Search by name or email…"
              className="w-full border border-bone bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-gold transition-colors rounded-sm placeholder-mist"
            />
            {query && (
              <button onClick={() => { setQuery(''); setPage(1); }} className="text-xs text-mist hover:text-charcoal">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No users found.</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {paged.map(u => (
              <Link
                key={u.user_id}
                href={`/manzura/users/${u.user_id}`}
                className="flex items-center justify-between gap-3 bg-white border border-bone rounded-sm p-4 hover:border-gold transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-charcoal truncate">{u.full_name}</p>
                    {u.customer_code && (
                      <span className="text-[10px] font-mono tracking-widest bg-cream text-gold-dark border border-gold/30 px-1.5 py-0.5 rounded shrink-0">
                        {u.customer_code}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-mist truncate">{u.email}</p>
                  {!u.email_verified && (
                    <span className="inline-block mt-1 text-[9px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Email not confirmed
                    </span>
                  )}
                  <p className="text-[11px] text-mist mt-1">
                    {u.order_count} order{u.order_count !== 1 ? 's' : ''}
                    {u.total_spent_cents > 0 && ` · ${formatTotal(u.total_spent_cents)}`}
                    {' · '}
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight size={14} className="text-mist shrink-0" />
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white border border-bone overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-bone">
                  <tr className="text-[10px] uppercase tracking-widest text-mist">
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold">Customer ID</th>
                    <th className="text-left px-4 py-3 font-semibold">City</th>
                    <th className="text-right px-4 py-3 font-semibold">Orders</th>
                    <th className="text-left px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(u => (
                    <tr key={u.user_id} className="border-t border-bone hover:bg-cream/50">
                      <td className="px-4 py-3 text-charcoal font-medium whitespace-nowrap">{u.full_name}</td>
                      <td className="px-4 py-3 text-mist text-xs max-w-[14rem]">
                        <span className="block truncate">{u.email}</span>
                        {!u.email_verified && (
                          <span className="inline-block mt-1 text-[9px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                            Not confirmed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-mist text-xs whitespace-nowrap">{u.phone}</td>
                      <td className="px-4 py-3">
                        {u.customer_code ? (
                          <span className="text-[11px] font-mono tracking-widest bg-cream text-gold-dark border border-gold/30 px-2 py-0.5 rounded">
                            {u.customer_code}
                          </span>
                        ) : (
                          <span className="text-mist text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-mist text-xs whitespace-nowrap">{u.city}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-charcoal">{u.order_count}</span>
                        {u.total_spent_cents > 0 && (
                          <div className="text-[11px] text-mist">{formatTotal(u.total_spent_cents)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/manzura/users/${u.user_id}`}
                          className="text-xs text-gold-dark hover:text-gold underline underline-offset-2"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 inline-flex items-center justify-center border rounded-md text-xs transition-colors ${
                    n === safePage
                      ? 'border-gold bg-gold text-white'
                      : 'border-bone text-charcoal hover:border-gold hover:text-gold-dark'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
