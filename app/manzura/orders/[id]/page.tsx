import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getStockFlagsMap, stockKey } from '@/lib/products/stock';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { findCountry } from '@/lib/countries';
import AdminOrderStatusPanel from '@/components/admin/AdminOrderStatusPanel';
import AdminOrderMessages from '@/components/admin/AdminOrderMessages';
import OrderReceiptModal from '@/components/admin/OrderReceiptModal';
import OrderAttachments from '@/components/account/OrderAttachments';
import EmailVerifiedMark from '@/components/account/EmailVerifiedMark';

export const dynamic = 'force-dynamic';

const PROOF_BUCKET = 'payment-proofs';
const SHIPMENT_BUCKET = 'shipment-photos';
const PROOF_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SHIPMENT_PHOTO_TTL_SECONDS = 60 * 60; // admin-side: short — page rerenders fetch a fresh URL

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
  option: string | null;
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
  carrier: string | null;
  tracking_number: string | null;
  shipment_photo_path: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  last_message_seen_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  sender_role: 'admin' | 'customer';
  body: string;
  is_internal: boolean;
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

  const [{ data: items }, { data: messages }, { data: customerProfile }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, product_id, product_name, unit_cents, quantity, line_cents, option')
      .eq('order_id', detail.id)
      .order('id'),
    supabase
      .from('order_messages')
      .select('id, sender_role, body, is_internal, created_at')
      .eq('order_id', detail.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('customer_profiles')
      .select('customer_code, email_verified')
      .eq('user_id', detail.user_id)
      .maybeSingle(),
  ]);
  const customerCode = (customerProfile as { customer_code?: string } | null)?.customer_code ?? null;
  const customerEmailVerified =
    (customerProfile as { email_verified?: boolean } | null)?.email_verified ?? false;

  // Current stock per ordered product, to flag oversold items. Stock is only
  // deducted at packaging, so for pre-packaging orders this compares the order
  // against live shelf stock; once packed, stock already reflects the deduction
  // (so a packed order shows no shortfall). An item is "short" when the ordered
  // quantity exceeds the stock we currently hold — the order can't be packed
  // until it's replenished.
  const orderItems = ((items ?? []) as OrderItem[]);
  const itemFlags = await getStockFlagsMap(orderItems.map(i => ({ product_id: i.product_id, option: i.option ?? '' })));
  const stockOf = (pid: number, option: string | null) => itemFlags[stockKey(pid, option ?? '')]?.stock ?? 0;
  const shortItems = orderItems.filter(i => stockOf(i.product_id, i.option) < i.quantity);
  const isPacked = ['packaging', 'shipped', 'delivered'].includes(detail.status);
  const showShortfall = shortItems.length > 0 && !isPacked;

  // Customer photo attachments (#8): rows then signed URLs (private bucket).
  const { data: attachmentRows } = await supabase
    .from('order_attachments')
    .select('id, storage_path, comment, created_at')
    .eq('order_id', detail.id)
    .order('created_at', { ascending: true });
  const attachments = await Promise.all(
    (attachmentRows ?? []).map(async a => {
      const { data: signed } = await supabase.storage
        .from('order-attachments')
        .createSignedUrl(a.storage_path as string, SHIPMENT_PHOTO_TTL_SECONDS);
      return {
        id: a.id as number,
        url: signed?.signedUrl ?? '',
        comment: (a.comment as string | null) ?? null,
        createdAt: a.created_at as string,
      };
    }),
  );

  // Always mint a fresh signed URL on render so the admin can open the proof
  // even years after the email's 7-day link expires.
  let proofSignedUrl: string | undefined;
  if (detail.payment_proof_path) {
    const { data: signed } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(detail.payment_proof_path, PROOF_SIGNED_URL_TTL_SECONDS);
    proofSignedUrl = signed?.signedUrl;
  }

  let shipmentPhotoUrl: string | undefined;
  if (detail.shipment_photo_path) {
    const { data: signed } = await supabase.storage
      .from(SHIPMENT_BUCKET)
      .createSignedUrl(detail.shipment_photo_path, SHIPMENT_PHOTO_TTL_SECONDS);
    shipmentPhotoUrl = signed?.signedUrl;
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
        <div className="flex items-center gap-2">
          <OrderReceiptModal
            orderId={detail.id}
            orderNumber={display}
            customerName={detail.customer_name}
            customerEmail={detail.customer_email}
            customerPhone={detail.customer_phone}
            customerCode={customerCode}
            fedexAccount={detail.fedex_account}
            shippingAddress={{
              street: detail.shipping_address.street,
              city: detail.shipping_address.city,
              state_province: detail.shipping_address.state_province,
              postal_code: detail.shipping_address.postal_code,
              country: detail.shipping_address.country,
              countryName,
            }}
            items={(items ?? []) as OrderItem[]}
            subtotalCents={detail.subtotal_cents}
            shippingCents={detail.shipping_cents}
            totalCents={detail.total_cents}
            currency={detail.currency}
            createdAt={detail.created_at}
          />
          <Link href="/manzura/orders" className="text-xs text-mist hover:text-charcoal border border-bone px-4 py-2 transition-colors">
            ← Orders
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Stat label="Created" value={new Date(detail.created_at).toLocaleString()} />
        <Stat label="Customer ID" value={customerCode ?? '—'} />
        <div className="bg-white border border-bone p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-mist mb-1">Shipped at</div>
          <div className="text-sm text-charcoal flex items-center gap-2">
            {detail.shipped_at
              ? new Date(detail.shipped_at).toLocaleString()
              : <span className="text-mist">Pending</span>}
            {detail.shipped_at && detail.status === 'shipped' && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold leading-none shrink-0" title="Newly shipped — not yet delivered">!</span>
            )}
          </div>
        </div>
      </div>

      {showShortfall && (
        <section className="bg-rose-50 border border-rose-300 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-bold leading-none shrink-0 mt-0.5">!</span>
            <div className="text-sm text-rose-800">
              <p className="font-semibold">재고 초과 품목 {shortItems.length}개 — 재입고 필요</p>
              <p className="text-xs text-rose-700 mt-1">
                아래 빨간 품목은 주문 수량이 현재 재고보다 많습니다. <span className="font-semibold">add inbound</span>으로 재고를 채우기 전까지는 <span className="font-semibold">packaging으로 넘길 수 없습니다.</span>
              </p>
            </div>
          </div>
        </section>
      )}

      <AdminOrderStatusPanel
        orderId={detail.id}
        status={detail.status}
        carrier={detail.carrier}
        trackingNumber={detail.tracking_number}
        shipmentPhotoPath={detail.shipment_photo_path}
      />

      {shipmentPhotoUrl && (
        <section className="bg-white border border-bone rounded-lg p-5">
          <h2 className="font-display text-lg text-charcoal mb-3">Shipment photo</h2>
          <a href={shipmentPhotoUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shipmentPhotoUrl} alt="Shipment" className="max-h-96 border border-bone rounded-md bg-white" />
          </a>
          <p className="text-[11px] text-mist mt-2">
            Signed link regenerates every time you open this page.
          </p>
        </section>
      )}

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
          <div className="flex items-center gap-2 flex-wrap">
            <span>{detail.customer_email}</span>
            <EmailVerifiedMark verified={customerEmailVerified} />
            {customerEmailVerified ? (
              <span className="text-xs font-medium text-blue-600">Email confirmed</span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Email not confirmed
              </span>
            )}
          </div>
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
              <th className="text-center py-2">Stock</th>
              <th className="text-right py-2">Unit</th>
              <th className="text-right py-2">Line</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((it: OrderItem) => {
              const stock = stockOf(it.product_id, it.option);
              const short = !isPacked && stock < it.quantity;
              return (
              <tr key={it.id} className="border-b border-bone">
                <td className="py-2 text-charcoal">
                  {it.product_name}{it.option ? ` (${it.option})` : ''}
                  {short && (
                    <span className="block text-[11px] font-semibold text-rose-700 mt-0.5">
                      재입고 필요 — {it.quantity - stock}개 부족
                    </span>
                  )}
                </td>
                <td className={`py-2 text-center ${short ? 'text-rose-700 font-bold' : 'text-charcoal'}`}>{it.quantity}</td>
                <td className={`py-2 text-center ${short ? 'text-rose-700 font-bold' : 'text-charcoal'}`}>
                  {isPacked ? '—' : stock}
                </td>
                <td className="py-2 text-right text-charcoal">{formatUSD(it.unit_cents, detail.currency)}</td>
                <td className="py-2 text-right text-charcoal">{formatUSD(it.line_cents, detail.currency)}</td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-1 pr-4 text-right text-xs text-mist">Subtotal</td>
              <td className="py-1 text-right text-charcoal">{formatUSD(detail.subtotal_cents, detail.currency)}</td>
            </tr>
            {detail.subtotal_cents + detail.shipping_cents - detail.total_cents > 0 && (
              <tr>
                <td colSpan={4} className="py-1 pr-4 text-right text-xs text-emerald-700">
                  Discount{detail.discount_code ? ` (${detail.discount_code})` : ''}
                </td>
                <td className="py-1 text-right text-emerald-700">
                  -{formatUSD(detail.subtotal_cents + detail.shipping_cents - detail.total_cents, detail.currency)}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={4} className="py-1 pr-4 text-right text-xs text-mist">Shipping</td>
              <td className="py-1 text-right text-charcoal">{formatUSD(detail.shipping_cents, detail.currency)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-2 pr-4 text-right text-xs uppercase tracking-widest text-charcoal font-semibold border-t-2 border-charcoal">
                Total
              </td>
              <td className="py-2 text-right text-charcoal font-display text-lg border-t-2 border-charcoal">
                {formatUSD(detail.total_cents, detail.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="bg-white border border-bone rounded-lg p-5">
        <h2 className="font-display text-lg text-charcoal mb-3">Customer photos</h2>
        <OrderAttachments orderId={detail.id} attachments={attachments} readOnly />
      </section>

      <AdminOrderMessages
        orderId={detail.id}
        messages={(messages ?? []) as MessageRow[]}
        lastMessageSeenAt={detail.last_message_seen_at}
      />
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
