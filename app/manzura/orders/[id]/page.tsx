import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { findCountry } from '@/lib/countries';

export const dynamic = 'force-dynamic';

const PROOF_BUCKET = 'payment-proofs';
const PROOF_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function formatUSD(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  unit_cents: number;
  quantity: number;
  line_cents: number;
}

interface ShippingAddress {
  street: string;
  city: string;
  state_province?: string | null;
  postal_code: string;
  country: string;
}

interface OrderDetail {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fedex_account: string | null;
  shipping_address: ShippingAddress;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  notes: string | null;
  discount_code: string | null;
  payment_method: string | null;
  payment_proof_path: string | null;
  payment_transaction_link: string | null;
  created_at: string;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', numericId)
    .single();
  if (error || !order) notFound();

  const detail = order as OrderDetail;

  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, product_name, unit_cents, quantity, line_cents')
    .eq('order_id', detail.id)
    .order('id');

  // Always mint a fresh signed URL on render so the admin can open the proof
  // even years after the email's 7-day link expires.
  let proofSignedUrl: string | undefined;
  if (detail.payment_proof_path) {
    const { data: signed } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(detail.payment_proof_path, PROOF_SIGNED_URL_TTL_SECONDS);
    proofSignedUrl = signed?.signedUrl;
  }

  const display =
    detail.order_seq !== null ? formatOrderNumber(detail.order_seq) : detail.order_number;
  const countryName =
    findCountry(detail.shipping_address.country)?.name ?? detail.shipping_address.country;

  const proofIsPdf = detail.payment_proof_path?.toLowerCase().endsWith('.pdf');

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-mist mb-1">Order</p>
          <h1 className="font-display text-3xl font-light text-charcoal font-mono">{display}</h1>
        </div>
        <Link href="/manzura/orders" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2 transition-colors">
          ← Orders
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Stat label="Status" value={detail.status.toUpperCase()} />
        <Stat label="Created" value={new Date(detail.created_at).toLocaleString()} />
        <Stat label="Payment method" value={detail.payment_method ?? '—'} />
        <Stat label="Customer ID" value={detail.user_id.slice(0, 8) + '…'} />
      </div>

      {(proofSignedUrl || detail.payment_transaction_link) && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <h2 className="font-display text-lg text-charcoal mb-3">Payment verification</h2>
          {proofSignedUrl && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest text-emerald-700 mb-2">Screenshot</div>
              {proofIsPdf ? (
                <a
                  href={proofSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-white border border-emerald-300 rounded-md text-sm text-emerald-800 hover:bg-emerald-100"
                >
                  Open PDF in new tab
                </a>
              ) : (
                <a href={proofSignedUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proofSignedUrl}
                    alt="Payment screenshot"
                    className="max-h-96 border border-emerald-300 rounded-md bg-white"
                  />
                </a>
              )}
              <p className="text-[11px] text-emerald-700 mt-2">
                Signed link regenerates every time you open this page — no need to bookmark.
              </p>
            </div>
          )}
          {detail.payment_transaction_link && (
            <div>
              <div className="text-xs uppercase tracking-widest text-emerald-700 mb-1">Transaction link</div>
              <a
                href={detail.payment_transaction_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-800 hover:underline break-all"
              >
                {detail.payment_transaction_link}
              </a>
            </div>
          )}
        </section>
      )}

      <section className="bg-white border border-bone rounded-lg p-5">
        <h2 className="font-display text-lg text-charcoal mb-3">Customer</h2>
        <div className="text-sm text-charcoal space-y-1">
          <div className="font-semibold">{detail.customer_name}</div>
          <div>{detail.customer_email}</div>
          <div>{detail.customer_phone}</div>
        </div>
      </section>

      <section className="bg-white border border-bone rounded-lg p-5">
        <h2 className="font-display text-lg text-charcoal mb-3">Ship to</h2>
        <div className="text-sm text-charcoal whitespace-pre-line leading-relaxed">
          {[
            detail.shipping_address.street,
            [
              detail.shipping_address.city,
              detail.shipping_address.state_province,
              detail.shipping_address.postal_code,
            ]
              .filter(Boolean)
              .join(', '),
            countryName,
          ].join('\n')}
        </div>
        {detail.fedex_account && (
          <p className="text-xs text-mist mt-3">
            FedEx account: <span className="font-mono">{detail.fedex_account}</span>
          </p>
        )}
      </section>

      {(detail.notes || detail.discount_code) && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          {detail.notes && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest text-amber-800 mb-2">Customer notes / Reference</div>
              <div className="text-sm text-charcoal whitespace-pre-wrap">{detail.notes}</div>
            </div>
          )}
          {detail.discount_code && (
            <div>
              <div className="text-xs uppercase tracking-widest text-amber-800 mb-2">Discount code (manual)</div>
              <div className="text-sm font-mono bg-white border border-amber-200 inline-block px-3 py-1.5 rounded">
                {detail.discount_code}
              </div>
              <p className="text-xs text-amber-700 mt-2">
                No discount has been applied automatically — verify the code and adjust the total manually before shipping.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="bg-white border border-bone rounded-lg p-5">
        <h2 className="font-display text-lg text-charcoal mb-3">Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-mist border-b border-bone">
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2">Qty</th>
              <th className="text-right py-2">Unit</th>
              <th className="text-right py-2">Line</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it: OrderItem) => (
              <tr key={it.id} className="border-b border-bone">
                <td className="py-2 text-charcoal">{it.product_name}</td>
                <td className="py-2 text-center text-charcoal">{it.quantity}</td>
                <td className="py-2 text-right text-charcoal">{formatUSD(it.unit_cents, detail.currency)}</td>
                <td className="py-2 text-right text-charcoal">{formatUSD(it.line_cents, detail.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-1 pr-4 text-right text-xs text-mist">Subtotal</td>
              <td className="py-1 text-right text-charcoal">{formatUSD(detail.subtotal_cents, detail.currency)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-1 pr-4 text-right text-xs text-mist">Shipping</td>
              <td className="py-1 text-right text-charcoal">{formatUSD(detail.shipping_cents, detail.currency)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-2 pr-4 text-right text-xs uppercase tracking-widest text-charcoal font-semibold border-t-2 border-charcoal">
                Total
              </td>
              <td className="py-2 text-right text-charcoal font-display text-lg border-t-2 border-charcoal">
                {formatUSD(detail.total_cents, detail.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-bone p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-mist mb-1">{label}</div>
      <div className="text-sm text-charcoal">{value}</div>
    </div>
  );
}
