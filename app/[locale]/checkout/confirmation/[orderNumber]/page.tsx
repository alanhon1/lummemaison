import { notFound } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import ConfirmationClient, { type OrderView } from '@/components/checkout/ConfirmationClient';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import { findCountry } from '@/lib/countries';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

// Constant-time string equality. view_token is a UUID v4 (36 chars), so
// length is fixed — but we double-check length up front to avoid leaking the
// expected length via the length-mismatch return path.
function tokenEq(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

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

  // Hidden test order (postal code "ALANTEST") — nothing was persisted, so
  // there's no real order to load. Show a plain confirmation that the test ran.
  if (orderNumber === 'test') {
    return (
      <main className="bg-cream min-h-[70vh] py-16 px-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-bone rounded-lg p-8 text-center">
          <p className="text-4xl mb-3">🧪</p>
          <h1 className="font-display text-2xl text-charcoal mb-2">Test order complete</h1>
          <p className="text-sm text-mist leading-relaxed">
            This was a test (postal code “ALANTEST”). Nothing was saved — no order, no
            email, and no stock change. It will not appear in orders, stock, or exports.
          </p>
        </div>
      </main>
    );
  }

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

  // Access gate. Tightened over the previous "owner OR token" rule:
  //
  //   - If there IS a session, ownership is the only thing that counts.
  //     A signed-in user changing the seq in the URL to peek at someone
  //     else's order — even with a valid ?t= token leaked from somewhere
  //     — gets 404. The token is purely an anonymous fallback.
  //
  //   - If there is NO session, a valid view_token still grants access
  //     (the post-checkout redirect + email links rely on this).
  //
  // Both branches end in notFound() with no body, so 404 cases are
  // indistinguishable from "seq does not exist".
  if (user) {
    if (order.user_id !== user.id) notFound();
  } else {
    if (!token || !tokenEq(token, order.view_token)) notFound();
  }

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

  // Feedback is only offered to the signed-in owner of this order (RLS requires
  // auth.uid() = user_id). Load any existing feedback so a returning visitor
  // sees their submitted state rather than a fresh prompt. Tolerant of the
  // feedback table not existing yet (before migration 009 is applied).
  const canFeedback = Boolean(user && order.user_id === user.id);
  type FeedbackInitial = { id: number; rating: 'up' | 'down'; comment: string | null };
  let feedbackInitial: FeedbackInitial | null = null;
  if (canFeedback) {
    const { data: fb } = await supabase
      .from('feedback')
      .select('id, rating, comment')
      .eq('order_id', order.id)
      .maybeSingle();
    if (fb) {
      feedbackInitial = {
        id: fb.id as number,
        rating: fb.rating as 'up' | 'down',
        comment: (fb.comment as string | null) ?? null,
      };
    }
  }

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-2">{t('confirmation.title')}</h1>
        <p className="text-sm text-mist mb-8">{t('confirmation.subtitle')}</p>
        <CheckoutSteps current="done" />
        {canFeedback && <FeedbackWidget orderId={order.id} initial={feedbackInitial} />}
        <ConfirmationClient order={view} countryName={countryName} />
      </div>
    </main>
  );
}
