import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import FeedbacksClient, { type FeedbackRow } from '@/components/admin/FeedbacksClient';

export const dynamic = 'force-dynamic';

// Shape of the embedded order on a feedback row (to-one via order_id FK).
interface EmbeddedOrder {
  customer_name: string | null;
  customer_email: string | null;
  order_seq: number | null;
  order_number: string | null;
}

export default async function AdminFeedbacksPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();
  const [{ data, error }, { data: faqData }] = await Promise.all([
    admin
      .from('feedback')
      .select(
        'id, rating, comment, is_read, created_at, order_id, user_id, orders(customer_name, customer_email, order_seq, order_number)',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('faq_feedback')
      .select('id, faq_number, rating, comment, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-light text-charcoal mb-4">Feedback</h1>
        <p className="text-sm text-red-600">
          Failed to load feedback: {error.message}
        </p>
        <p className="text-xs text-mist mt-2">
          If this is the first run, apply <code>supabase/migrations/009_feedback.sql</code> in the Supabase SQL editor.
        </p>
      </div>
    );
  }

  const orderRows: FeedbackRow[] = (data ?? []).map(f => {
    const raw = (f as { orders?: EmbeddedOrder | EmbeddedOrder[] | null }).orders;
    const ord = Array.isArray(raw) ? raw[0] : raw;
    const orderRef = ord
      ? ord.order_seq != null
        ? formatOrderNumber(ord.order_seq)
        : ord.order_number
      : null;
    return {
      id: f.id as number,
      rating: f.rating as 'up' | 'down',
      comment: (f.comment as string | null) ?? null,
      is_read: Boolean(f.is_read),
      created_at: f.created_at as string,
      orderRef,
      customerName: ord?.customer_name ?? null,
      customerEmail: ord?.customer_email ?? null,
      feedbackTable: 'feedback' as const,
    };
  });

  const faqRows: FeedbackRow[] = (faqData ?? []).map(f => ({
    id: f.id as number,
    rating: f.rating as 'up' | 'down',
    comment: (f.comment as string | null) ?? null,
    is_read: Boolean(f.is_read),
    created_at: f.created_at as string,
    orderRef: null,
    customerName: null,
    customerEmail: null,
    source: `FAQ No.${f.faq_number}`,
    feedbackTable: 'faq_feedback' as const,
  }));

  const rows: FeedbackRow[] = [...orderRows, ...faqRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return <FeedbacksClient rows={rows} />;
}
