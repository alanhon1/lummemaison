import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import ConfirmationClient, { type OrderView } from '@/components/checkout/ConfirmationClient';
import { findCountry } from '@/lib/countries';

interface PageProps {
  params: Promise<{ locale: string; orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('confirmation.title') };
}

export default async function CheckoutConfirmationPage({ params }: PageProps) {
  const { locale, orderNumber } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/account/login`);
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'order_number, total_cents, subtotal_cents, shipping_cents, currency, customer_name, customer_email, customer_phone, fedex_account, shipping_address, created_at, status, user_id',
    )
    .eq('order_number', orderNumber)
    .single();

  if (error || !order) notFound();
  // RLS already restricts to own rows, but double-check defensively.
  if (order.user_id !== user.id) notFound();

  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, product_name, unit_cents, quantity, line_cents')
    .eq('order_id', (await supabase.from('orders').select('id').eq('order_number', orderNumber).single()).data?.id ?? -1);

  const view: OrderView = {
    order_number: order.order_number,
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
