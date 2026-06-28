import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { ClickableRow } from '@/components/admin/ClickableRow';

export const dynamic = 'force-dynamic';

// Sanitise the search query before it goes into a PostgREST `.or()` string.
// We allow letters/digits/space/@/./_/- — anything else is dropped. This is
// not an injection defence (supabase-js parameterises anyway) but it keeps
// the PostgREST filter syntax happy without quoting heroics, and clamps the
// length to a reasonable upper bound.
function sanitiseQuery(q: string | undefined): string {
  if (!q) return '';
  return q.replace(/[^a-zA-Z0-9 @._-]/g, '').trim().slice(0, 100);
}

interface OrderRow {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  total_cents: number;
  currency: string;
  created_at: string;
  payment_proof_path: string | null;
  payment_transaction_link: string | null;
}

function formatTotal(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

// Admin-side status badge palette. Mirrors the new Phase C vocab from
// supabase/migrations/006_order_status_flow.sql.
function statusBadge(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    quote_pending:    { cls: 'bg-violet-50 text-violet-700 border border-violet-200', label: 'Quote pending' },
    awaiting_payment: { cls: 'bg-orange-50 text-orange-700 border border-orange-200', label: 'Awaiting payment' },
    order_received:   { cls: 'bg-cream text-gold-dark border border-gold/30', label: 'Received' },
    payment_verified: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Payment verified' },
    packaging:        { cls: 'bg-amber-50 text-amber-800 border border-amber-200', label: 'Packing' },
    shipped:          { cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200', label: 'Shipped' },
    delivered:        { cls: 'bg-charcoal text-cream border border-charcoal', label: 'Delivered' },
    cancelled:        { cls: 'bg-stone-100 text-stone-500 border border-stone-300 line-through', label: 'Cancelled' },
  };
  return map[status] ?? { cls: 'bg-gray-100 text-gray-700', label: status };
}

// Filter chips. Order matches the order-flow stepper so the row reads as a
// progression. `all` is the default; `cancelled` is appended as the escape
// hatch. Keep in sync with statusBadge() vocab above.
const FILTER_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'quote_pending', label: 'Quote pending' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'order_received', label: 'Received' },
  { value: 'payment_verified', label: 'Payment verified' },
  { value: 'packaging', label: 'Packing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const VALID_STATUS_FILTERS = new Set(
  FILTER_TABS.filter(t => t.value !== 'all').map(t => t.value),
);

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const { status: rawStatus, q: rawQ } = await searchParams;
  const activeFilter =
    rawStatus && VALID_STATUS_FILTERS.has(rawStatus) ? rawStatus : 'all';
  const q = sanitiseQuery(rawQ);

  const supabase = createServiceClient();
  // Bumped limit when a search is active so a "Smith" search across years of
  // history actually returns all the matching rows, not just the most recent
  // 100 of them. The status-only browse remains capped at 100 for snappy
  // first-paint.
  let query = supabase
    .from('orders')
    .select(
      'id, order_seq, order_number, status, customer_name, customer_email, total_cents, currency, created_at, payment_proof_path, payment_transaction_link',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (activeFilter !== 'all') query = query.eq('status', activeFilter);
  if (q) {
    // Match across order_number / customer_name / customer_email by ILIKE,
    // plus order_seq exact-match if the query is all digits. The latter
    // lets mom paste "5000" or type the seq from a phone call and land it.
    const orParts = [
      `order_number.ilike.%${q}%`,
      `customer_name.ilike.%${q}%`,
      `customer_email.ilike.%${q}%`,
    ];
    if (/^\d+$/.test(q)) orParts.push(`order_seq.eq.${q}`);
    query = query.or(orParts.join(','));
  }
  const { data: orders, error } = await query;

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-red-600">Failed to load orders: {error.message}</p>
      </div>
    );
  }

  const rows = (orders ?? []) as OrderRow[];

  // Build status-chip hrefs that preserve any active search term, and the
  // search-form action that preserves any active status filter.
  function chipHref(value: string): string {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('status', value);
    if (q) params.set('q', q);
    const qs = params.toString();
    return qs ? `/manzura/orders?${qs}` : '/manzura/orders';
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Orders</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">
            {q
              ? `${rows.length} result${rows.length === 1 ? '' : 's'} for "${q}"${activeFilter === 'all' ? '' : ` in "${FILTER_TABS.find(t => t.value === activeFilter)?.label ?? activeFilter}"`}`
              : activeFilter === 'all'
              ? `Most recent ${rows.length} of ≤100`
              : `${rows.length} in "${FILTER_TABS.find(t => t.value === activeFilter)?.label ?? activeFilter}"`}
          </p>
        </div>
      </div>

      {/* Search */}
      <form action="/manzura/orders" method="get" className="flex items-center gap-2 mb-4">
        {/* Preserve the active status filter (if any) across search submits. */}
        {activeFilter !== 'all' && (
          <input type="hidden" name="status" value={activeFilter} />
        )}
        <div className="flex items-center gap-2 border border-bone bg-white px-3 py-2 flex-1 max-w-md">
          <Search size={13} className="text-mist" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by order #, name, or email…"
            className="flex-1 text-sm bg-transparent outline-none text-charcoal placeholder-mist"
          />
          {q && (
            <Link
              href={chipHref(activeFilter)}
              aria-label="Clear search"
              className="text-mist hover:text-charcoal"
            >
              <X size={12} />
            </Link>
          )}
        </div>
        <button type="submit" className="btn-gold text-xs">Search</button>
      </form>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {FILTER_TABS.map(t => {
          const active = t.value === activeFilter;
          return (
            <Link
              key={t.value}
              href={chipHref(t.value)}
              className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors border ${
                active
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No orders yet.</p>
      ) : (
        <>
        {/* Mobile: stacked cards (avoids horizontal scroll on a phone) */}
        <div className="md:hidden space-y-3">
          {rows.map(o => {
            const display = o.order_seq !== null ? formatOrderNumber(o.order_seq) : o.order_number;
            const hasProof = !!o.payment_proof_path || !!o.payment_transaction_link;
            const b = statusBadge(o.status);
            return (
              <Link
                key={o.id}
                href={`/manzura/orders/${o.id}`}
                className="block bg-white border border-bone rounded-sm p-4 hover:border-gold transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-charcoal">{display}</span>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${b.cls}`}>{b.label}</span>
                </div>
                <p className="text-sm text-charcoal leading-tight">{o.customer_name}</p>
                <p className="text-[11px] text-mist truncate">{o.customer_email}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-mist">
                    {new Date(o.created_at).toLocaleDateString()}
                    {hasProof && (
                      <span className="text-emerald-700 ml-1">
                        {o.payment_proof_path ? '🖼' : ''}
                        {o.payment_transaction_link ? '🔗' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-charcoal font-semibold">{formatTotal(o.total_cents, o.currency)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block bg-white border border-bone overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-bone">
              <tr className="text-[10px] uppercase tracking-widest text-mist">
                <th className="text-left px-4 py-3 font-semibold">Order</th>
                <th className="text-left px-4 py-3 font-semibold">Customer</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Proof</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-left px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(o => {
                const display =
                  o.order_seq !== null ? formatOrderNumber(o.order_seq) : o.order_number;
                const hasProof = !!o.payment_proof_path || !!o.payment_transaction_link;
                return (
                  <ClickableRow key={o.id} href={`/manzura/orders/${o.id}`} className="border-t border-bone hover:bg-cream/50">
                    <td className="px-4 py-3 font-mono text-charcoal">{display}</td>
                    <td className="px-4 py-3 text-charcoal">
                      <div className="leading-tight">
                        {o.customer_name}
                        <div className="text-[11px] text-mist truncate max-w-[16rem]">{o.customer_email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const b = statusBadge(o.status);
                        return (
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${b.cls}`}>
                            {b.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-mist">
                      {hasProof ? (
                        <span className="text-emerald-700">
                          {o.payment_proof_path ? '🖼' : ''}
                          {o.payment_transaction_link ? '🔗' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-charcoal text-right whitespace-nowrap">
                      {formatTotal(o.total_cents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
