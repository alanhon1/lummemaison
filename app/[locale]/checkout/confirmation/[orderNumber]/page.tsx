import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import ConfirmationClient, { type OrderView } from '@/components/checkout/ConfirmationClient';
import { findCountry } from '@/lib/countries';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

interface PageProps {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('confirmation.title') };
}

export default async function CheckoutConfirmationPage({ params, searchParams }: PageProps) {
  const { locale, orderNumber } = await params;
  const { t: token } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Service client bypasses RLS so that anonymous holders of a valid view_token
  // can also load the page (e.g. the post-checkout redirect before session
  // hydration, or a link sent via email). Access is enforced explicitly below.
  const admin = createServiceClient();

  // Param can be either a numeric order_seq (new SGL #005000 scheme) or the
  // legacy LM-YYYYMMDD-XXXX string. Try the appropriate column.
  const numericSeq = /^\d+$/.test(orderNumber) ? Number.parseInt(orderNumber, 10) : null;
  const query = admin
    .from('orders')
    .select(
      'id, order_number, order_seq, view_token, total_cents, subtotal_cents, shipping_cents, currency, customer_name, customer_email, customer_phone, fedex_account, shipping_address, created_at, status, user_id',
    );
  const { data: order, error } =
    numericSeq !== null
      ? await query.eq('order_seq', numericSeq).single()
      : await query.eq('order_number', orderNumber).single();

  if (error || !order) notFound();

  const ownsOrder = !!user && order.user_id === user.id;
  const tokenMatches = !!token && token === order.view_token;
  if (!ownsOrder && !tokenMatches) notFound();

  const { data: items } = await admin
    .from('order_items')
    .select('product_id, product_name, unit_cents, quantity, line_cents')
    .eq('order_id', order.id);

  const displayNumber =
    order.order_seq !== null && order.order_seq !== undefined
      ? formatOrderNumber(order.order_seq as number)
      : order.order_number;

  const view: OrderView = {
    order_number: displayNumber,
    total_cents: order.total_cents,
    subtotal_cents: order.subtotal_cents,
    shipping_cents: order.shipping_cents,
    currency: order.currency,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    fedex_account: order.fedex_account,
    shipping_address: order.shipping_address,
    created_at: order.created_at,
    status: order.status,
    items: items ?? [],
  };

  const t = await getTranslations({ locale, namespace: 'checkout' });
  const countryName = findCountry(order.shipping_address.country)?.name ?? order.shipping_address.country;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || '[admin email pending]';

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-2">{t('confirmation.title')}</h1>
        <p className="text-sm text-mist mb-8">{t('confirmation.subtitle')}</p>
        <CheckoutSteps current="done" />
        <ConfirmationClient order={view} countryName={countryName} adminEmail={adminEmail} />
      </div>
    </main>
  );
}
