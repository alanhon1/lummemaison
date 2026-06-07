import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import { findCountry } from '@/lib/countries';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { carrierLabel, carrierTrackUrl } from '@/lib/orders/carriers';
import OrderStepper from '@/components/account/OrderStepper';
import OrderStatusBadge from '@/components/account/OrderStatusBadge';
import MessagesSeenMarker from '@/components/account/MessagesSeenMarker';
import CancelOrderButton from '@/components/account/CancelOrderButton';
import ReorderButton from '@/components/account/ReorderButton';
import productsData from '@/data/products.json';

interface PageProps {
  params: Promise<{ locale: string; seq: string }>;
}

const ORDER_COLUMNS =
  'id, order_number, order_seq, user_id, status, subtotal_cents, shipping_cents, total_cents, currency, customer_name, customer_email, customer_phone, fedex_account, shipping_address, created_at, carrier, tracking_number, shipment_photo_path, shipped_at, delivered_at';

const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min — page is rendered server-side per request

export async function generateMetadata({ params }: PageProps) {
  const { locale, seq } = await params;
  const t = await getTranslations({ locale, namespace: 'account.orders' });
  const numericSeq = /^\d+$/.test(seq) ? Number.parseInt(seq, 10) : null;
  const number = numericSeq !== null ? formatOrderNumber(numericSeq) : seq;
  return { title: t('pageTitle', { number }) };
}

export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { locale, seq } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, '/account/login'));

  // Param is either the numeric order_seq (new SGL-style) or a legacy
  // order_number (LM-YYYYMMDD-XXXX). Same dual lookup as the public
  // confirmation page in app/[locale]/checkout/confirmation/[orderNumber]/page.tsx.
  const numericSeq = /^\d+$/.test(seq) ? Number.parseInt(seq, 10) : null;
  const query = supabase.from('orders').select(ORDER_COLUMNS).eq('user_id', user.id);
  const { data: order } =
    numericSeq !== null
      ? await query.eq('order_seq', numericSeq).maybeSingle()
      : await query.eq('order_number', seq).maybeSingle();

  // RLS already filters to auth.uid() = user_id (migration 001), but the
  // explicit .eq('user_id', user.id) above keeps it defence-in-depth and
  // also gives a clean 404 when the param targets someone else's order.
  if (!order) notFound();

  const [{ data: items }, { data: messages }] = await Promise.all([
    supabase
      .from('order_items')
      .select('product_id, product_name, unit_cents, quantity, line_cents')
      .eq('order_id', order.id),
    supabase
      .from('order_messages')
      .select('id, sender_role, body, created_at')
      .eq('order_id', order.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true }),
  ]);

  // Shipment photo: only mint a signed URL if the order is shipped AND the
  // photo path is set AND the viewer owns the order (already enforced above).
  // Service role is needed for the storage API (anon can't sign for a private
  // bucket); ownership check above is what makes this safe.
  let shipmentPhotoUrl: string | null = null;
  if (order.status !== 'order_received' && order.shipment_photo_path) {
    const admin = createServiceClient();
    const { data: signed } = await admin.storage
      .from('shipment-photos')
      .createSignedUrl(order.shipment_photo_path, SIGNED_URL_TTL_SECONDS);
    shipmentPhotoUrl = signed?.signedUrl ?? null;
  }

  const t = await getTranslations({ locale, namespace: 'account.orders' });

  // Build reorder items: enrich order_items with image/specification from products.json
  const productMap = new Map(productsData.products.map(p => [p.id, p]));
  const reorderItems = (items ?? []).map(item => {
    const p = productMap.get(item.product_id);
    return {
      id: item.product_id,
      name: item.product_name,
      price: item.unit_cents / 100,
      image: p?.image ?? '',
      specification: p?.specification ?? '',
      quantity: item.quantity,
    };
  });

  const displayNumber =
    order.order_seq !== null && order.order_seq !== undefined
      ? formatOrderNumber(order.order_seq as number)
      : order.order_number;
  const countryName =
    findCountry(order.shipping_address.country)?.name ?? order.shipping_address.country;

  const trackHref = carrierTrackUrl(order.carrier, order.tracking_number);

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      {/* Fire-and-forget: clears the unread-message badge on the dashboard
          once the customer actually opens this page. Renders nothing. */}
      <MessagesSeenMarker orderId={order.id} />
      <div className="max-w-3xl mx-auto">
        <Link
          href={localePath(locale, '/account')}
          className="text-xs tracking-widest uppercase text-mist hover:text-charcoal underline underline-offset-4"
        >
          ← {t('back')}
        </Link>

        <div className="flex items-baseline justify-between gap-4 mt-4 mb-1">
          <h1 className="font-display italic text-3xl md:text-4xl text-charcoal">{displayNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-mist mb-8">
          {new Date(order.created_at).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
        </p>

        <OrderStepper status={order.status} />

        {/* Cancel / Reorder row */}
        <div className="flex items-center gap-3 mb-6">
          {!['shipped', 'delivered', 'cancelled'].includes(order.status) && (
            <CancelOrderButton
              orderId={order.id}
              label={t('cancelOrder')}
              confirmText={t('cancelConfirm')}
              cancelText={t('cancelNo')}
            />
          )}
          <ReorderButton
            items={reorderItems}
            locale={locale}
            reorderLabel={t('reorder')}
            confirmText={t('reorderConfirm')}
          />
        </div>

        {/* Tracking + shipment photo */}
        {(order.tracking_number || order.shipment_photo_path) && (
          <section className="bg-white border border-bone rounded-lg p-5 md:p-6 mb-6">
            <h2 className="font-display italic text-xl text-charcoal mb-3">{t('tracking')}</h2>
            <dl className="space-y-2 text-sm">
              {order.carrier && (
                <div className="flex gap-3">
                  <dt className="w-32 text-mist">{t('carrier')}</dt>
                  <dd className="text-charcoal">{carrierLabel(order.carrier)}</dd>
                </div>
              )}
              {order.tracking_number && (
                <div className="flex gap-3">
                  <dt className="w-32 text-mist">{t('trackingNumber')}</dt>
                  <dd className="text-charcoal font-mono">{order.tracking_number}</dd>
                </div>
              )}
              {trackHref && (
                <div className="pt-2">
                  <a
                    href={trackHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold text-xs"
                  >
                    {t('trackingLink')}
                  </a>
                </div>
              )}
            </dl>
            {shipmentPhotoUrl && (
              <div className="mt-5">
                <p className="text-xs font-semibold tracking-widest uppercase text-mist mb-2">
                  {t('shipmentPhoto')}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shipmentPhotoUrl}
                  alt={t('shipmentPhoto')}
                  className="w-full max-w-md rounded-md border border-bone"
                />
              </div>
            )}
          </section>
        )}

        {/* Items + totals */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6 mb-6">
          <h2 className="font-display italic text-xl text-charcoal mb-4">{t('itemsTitle')}</h2>
          <ul className="space-y-2 text-sm">
            {(items ?? []).map(item => (
              <li key={item.product_id} className="flex justify-between gap-3">
                <span className="text-charcoal pr-3 line-clamp-1">
                  {item.product_name} <span className="text-mist">× {item.quantity}</span>
                </span>
                <span className="text-charcoal whitespace-nowrap">
                  {formatCurrency(item.line_cents, order.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-bone mt-3 pt-3 space-y-1.5 text-sm">
            <TotalRow label={t('subtotal')} value={formatCurrency(order.subtotal_cents, order.currency, locale)} />
            <TotalRow label={t('shipping')} value={formatCurrency(order.shipping_cents, order.currency, locale)} />
            <TotalRow
              label={t('total')}
              value={formatCurrency(order.total_cents, order.currency, locale)}
              emphasis
            />
          </div>
        </section>

        {/* Shipping address */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6 mb-6">
          <h2 className="font-display italic text-xl text-charcoal mb-3">{t('shippingTitle')}</h2>
          <p className="text-sm text-charcoal leading-relaxed">
            {order.customer_name}
            <br />
            {order.shipping_address.street}
            <br />
            {[order.shipping_address.city, order.shipping_address.state_province, order.shipping_address.postal_code]
              .filter(Boolean)
              .join(', ')}
            <br />
            {countryName}
          </p>
        </section>

        {/* Messages from us */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
          <h2 className="font-display italic text-xl text-charcoal mb-4">{t('messages')}</h2>
          {(messages ?? []).length === 0 ? (
            <p className="text-sm text-mist italic">{t('noMessages')}</p>
          ) : (
            <ul className="space-y-4">
              {(messages ?? []).map(m => (
                <li key={m.id} className="border-l-2 border-gold/40 pl-4">
                  <p className="text-[10px] tracking-widest uppercase text-mist mb-1">
                    {new Date(m.created_at).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                  </p>
                  <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function formatCurrency(cents: number, currency: string, locale: string): string {
  return (cents / 100).toLocaleString(locale, { style: 'currency', currency });
}

function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? 'font-display text-base text-charcoal pt-1.5 border-t border-bone' : 'text-mist'}`}>
      <span>{label}</span>
      <span className={emphasis ? 'text-charcoal' : 'text-charcoal'}>{value}</span>
    </div>
  );
}
