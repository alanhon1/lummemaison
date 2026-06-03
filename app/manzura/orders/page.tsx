import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  customer_name: string;
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
    order_received:   { cls: 'bg-cream text-gold-dark border border-gold/30', label: 'Received' },
    payment_verified: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Payment verified' },
    packaging:        { cls: 'bg-amber-50 text-amber-800 border border-amber-200', label: 'Packing' },
    shipped:          { cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200', label: 'Shipped' },
    delivered:        { cls: 'bg-charcoal text-cream border border-charcoal', label: 'Delivered' },
    cancelled:        { cls: 'bg-stone-100 text-stone-500 border border-stone-300 line-through', label: 'Cancelled' },
  };
  return map[status] ?? { cls: 'bg-gray-100 text-gray-700', label: status };
}

export default async function AdminOrdersPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_seq, order_number, status, customer_name, total_cents, currency, created_at, payment_proof_path, payment_transaction_link',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-red-600">Failed to load orders: {error.message}</p>
      </div>
    );
  }

  const rows = (orders ?? []) as OrderRow[];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-4xl font-light text-charcoal">Orders</h1>
          <p className="text-xs text-mist mt-1 tracking-wider">Most recent 100</p>
        </div>
        <Link href="/manzura" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2 transition-colors">
          ← Dashboard
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No orders yet.</p>
      ) : (
        <div className="bg-white border border-bone overflow-hidden">
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
                  <tr key={o.id} className="border-t border-bone hover:bg-cream/50">
                    <td className="px-4 py-3">
                      <Link href={`/manzura/orders/${o.id}`} className="font-mono text-charcoal hover:text-gold-dark">
                        {display}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-charcoal">{o.customer_name}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
