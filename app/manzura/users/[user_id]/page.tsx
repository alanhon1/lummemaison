import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { findCountry } from '@/lib/countries';
import SendMessageForm from '@/components/admin/SendMessageForm';
import UserAnalyticsSection, { type AnalyticsOrder } from '@/components/admin/UserAnalyticsSection';
import EmailVerifiedMark from '@/components/account/EmailVerifiedMark';

export const dynamic = 'force-dynamic';

function formatTotal(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

function statusBadge(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    order_received:   { cls: 'bg-cream text-gold-dark border border-gold/30', label: 'Received' },
    payment_verified: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: 'Verified' },
    packaging:        { cls: 'bg-amber-50 text-amber-800 border border-amber-200', label: 'Packing' },
    shipped:          { cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200', label: 'Shipped' },
    delivered:        { cls: 'bg-charcoal text-cream border border-charcoal', label: 'Delivered' },
    cancelled:        { cls: 'bg-stone-100 text-stone-500 border border-stone-300 line-through', label: 'Cancelled' },
  };
  return map[status] ?? { cls: 'bg-gray-100 text-gray-700', label: status };
}

interface OrderRow {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  state_province: string | null;
  postal_code: string;
  fedex_account: string | null;
  customer_code: string | null;
  created_at: string;
  email_verified: boolean;
}

interface PageProps {
  params: Promise<{ user_id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const { user_id } = await params;
  const admin = createServiceClient();

  const [authResult, profileResult, ordersResult] = await Promise.all([
    admin.auth.admin.getUserById(user_id),
    admin.from('customer_profiles').select('*').eq('user_id', user_id).single(),
    admin
      .from('orders')
      .select('id, order_seq, order_number, status, total_cents, currency, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) notFound();

  const profile = profileResult.data as unknown as Profile;
  const email = authResult.data?.user?.email ?? '';
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const countryLabel = findCountry(profile.country)?.name ?? profile.country;

  // Fetch order items for analytics
  const orderIds = orders.map(o => o.id);
  let analyticsOrders: AnalyticsOrder[] = orders.map(o => ({ ...o, items: [] }));
  if (orderIds.length > 0) {
    const { data: itemRows } = await admin
      .from('order_items')
      .select('order_id, product_name, quantity, line_cents')
      .in('order_id', orderIds);

    const itemsByOrder = new Map<number, AnalyticsOrder['items']>();
    for (const row of itemRows ?? []) {
      const arr = itemsByOrder.get(row.order_id as number) ?? [];
      arr.push({
        product_name: row.product_name as string,
        quantity: row.quantity as number,
        line_cents: row.line_cents as number,
      });
      itemsByOrder.set(row.order_id as number, arr);
    }
    analyticsOrders = orders.map(o => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Back */}
      <Link href="/manzura/users" className="text-xs text-mist hover:text-charcoal underline underline-offset-2">
        ← Back to Users
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="font-display text-3xl font-light text-charcoal">{profile.full_name}</h1>
        {profile.customer_code && (
          <span className="text-sm font-mono tracking-widest bg-cream text-gold-dark border border-gold/30 px-3 py-1 rounded self-center">
            {profile.customer_code}
          </span>
        )}
      </div>

      {/* Profile card */}
      <section className="bg-white border border-bone rounded-sm p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Email</p>
          <p className="text-sm text-charcoal flex items-center gap-1.5">
            <span>{email || '—'}</span>
            <EmailVerifiedMark verified={profile.email_verified} />
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Phone</p>
          <p className="text-sm text-charcoal">{profile.phone}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Shipping Address</p>
          <p className="text-sm text-charcoal leading-relaxed">
            {profile.street}<br />
            {profile.city}{profile.state_province ? `, ${profile.state_province}` : ''} {profile.postal_code}<br />
            {countryLabel}
          </p>
        </div>
        {profile.fedex_account && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-mist mb-1">FedEx Account</p>
            <p className="text-sm text-charcoal font-mono">{profile.fedex_account}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Joined</p>
          <p className="text-sm text-charcoal">{new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </section>

      {/* Analytics */}
      <UserAnalyticsSection orders={analyticsOrders} />

      {/* Orders */}
      <section>
        <h2 className="font-display text-xl font-light text-charcoal mb-4">
          Orders{orders.length > 0 && <span className="text-mist font-sans text-sm ml-2 font-normal">({orders.length})</span>}
        </h2>

        {orders.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone p-6 text-center">No orders yet.</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {orders.map(o => {
                const display = o.order_seq !== null ? formatOrderNumber(o.order_seq) : o.order_number;
                const b = statusBadge(o.status);
                return (
                  <Link
                    key={o.id}
                    href={`/manzura/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 bg-white border border-bone rounded-sm p-3 hover:border-gold transition-colors"
                  >
                    <div>
                      <p className="font-mono text-sm text-charcoal">{display}</p>
                      <p className="text-[11px] text-mist mt-0.5">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                      <p className="text-xs text-charcoal font-semibold mt-1">{formatTotal(o.total_cents, o.currency)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white border border-bone overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-bone">
                  <tr className="text-[10px] uppercase tracking-widest text-mist">
                    <th className="text-left px-4 py-3 font-semibold">Order</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const display = o.order_seq !== null ? formatOrderNumber(o.order_seq) : o.order_number;
                    const b = statusBadge(o.status);
                    return (
                      <tr key={o.id} className="border-t border-bone hover:bg-cream/50">
                        <td className="px-4 py-3 font-mono text-charcoal">{display}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${b.cls}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-charcoal text-right">{formatTotal(o.total_cents, o.currency)}</td>
                        <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/manzura/orders/${o.id}`} className="text-xs text-gold-dark hover:text-gold underline underline-offset-2">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Send Message */}
      <SendMessageForm userId={profile.user_id} />
    </div>
  );
}
