import { Resend } from 'resend';
import { render } from '@react-email/render';
import CustomerOrderEmail from './templates/CustomerOrderEmail';
import AdminOrderEmail from './templates/AdminOrderEmail';
import type { OrderEmailPayload } from './types';
import { formatUSD } from './types';

export interface SendResult {
  customer: { ok: boolean; error?: string };
  admin: { ok: boolean; error?: string };
}

// Sends the two transactional emails after a successful order insert.
// Each send is wrapped in its own try/catch so a failure on one side
// never blocks the other or the order itself. Errors are logged to the
// Vercel function log so Manzura can spot delivery issues.
export async function sendOrderEmails(order: OrderEmailPayload): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  const adminTo = order.payment.adminEmail;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — skipping send for', order.orderNumber);
    return {
      customer: { ok: false, error: 'RESEND_API_KEY missing' },
      admin: { ok: false, error: 'RESEND_API_KEY missing' },
    };
  }
  if (!from) {
    console.warn('[email] RESEND_FROM_ADDRESS missing — skipping send for', order.orderNumber);
    return {
      customer: { ok: false, error: 'RESEND_FROM_ADDRESS missing' },
      admin: { ok: false, error: 'RESEND_FROM_ADDRESS missing' },
    };
  }

  const resend = new Resend(apiKey);

  const customerHtml = await render(CustomerOrderEmail({ order }));
  const customerText = await render(CustomerOrderEmail({ order }), { plainText: true });
  const adminHtml = await render(AdminOrderEmail({ order }));
  const adminText = await render(AdminOrderEmail({ order }), { plainText: true });

  // Customer email
  let customerResult: SendResult['customer'] = { ok: true };
  try {
    const { error } = await resend.emails.send({
      from,
      to: order.customerEmail,
      subject: `Your Lumée Maison Order ${order.orderNumber} — Payment Instructions`,
      html: customerHtml,
      text: customerText,
      replyTo: adminTo,
    });
    if (error) {
      customerResult = { ok: false, error: error.message };
      console.error('[email] customer send failed', order.orderNumber, error);
    }
  } catch (e) {
    customerResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    console.error('[email] customer send threw', order.orderNumber, e);
  }

  // Admin email
  let adminResult: SendResult['admin'] = { ok: true };
  try {
    const { error } = await resend.emails.send({
      from,
      to: adminTo,
      subject: `New Order ${order.orderNumber} — ${order.customerName} — ${formatUSD(order.totalCents)}`,
      html: adminHtml,
      text: adminText,
      replyTo: order.customerEmail,
    });
    if (error) {
      adminResult = { ok: false, error: error.message };
      console.error('[email] admin send failed', order.orderNumber, error);
    }
  } catch (e) {
    adminResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    console.error('[email] admin send threw', order.orderNumber, e);
  }

  return { customer: customerResult, admin: adminResult };
}
