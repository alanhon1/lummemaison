import { getTransporter } from './mailer';
import { customerEmail, adminEmail, type OrderData } from './templates';
import { createServiceClient } from '@/lib/supabase/server';

export type { OrderData } from './templates';

export interface SendResult {
  customer: { ok: boolean; error?: string };
  admin: { ok: boolean; error?: string };
}

const PROOF_BUCKET = 'payment-proofs';
const PROOF_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Mints a signed URL for the admin email. Failure is non-fatal — we still
// send the email, just without the link, so the admin can open the order in
// /manzura/orders to view the proof.
async function mintProofSignedUrl(path: string): Promise<string | undefined> {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(path, PROOF_SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      console.error('[email] signed URL mint failed', path, error?.message);
      return undefined;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('[email] signed URL mint threw', path, e);
    return undefined;
  }
}

// Sends customer + admin transactional emails in parallel via Promise.allSettled.
// Never throws. One side failing never blocks the other or the surrounding
// order-creation flow. All failures are logged with the order number.
export async function sendOrderEmails(order: OrderData): Promise<SendResult> {
  const from = process.env.SMTP_FROM;
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!from || !adminTo) {
    const reason = !from ? 'SMTP_FROM missing' : 'ADMIN_NOTIFICATION_EMAIL missing';
    console.warn(`[email] ${reason} — skipping send for`, order.orderNumber);
    return {
      customer: { ok: false, error: reason },
      admin: { ok: false, error: reason },
    };
  }

  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] transporter init failed', order.orderNumber, msg);
    return {
      customer: { ok: false, error: msg },
      admin: { ok: false, error: msg },
    };
  }

  const proofSignedUrl = order.proofPath
    ? await mintProofSignedUrl(order.proofPath)
    : undefined;
  const enriched: OrderData = proofSignedUrl ? { ...order, proofSignedUrl } : order;

  const cust = customerEmail(enriched);
  const adm = adminEmail(enriched);

  const [custOutcome, admOutcome] = await Promise.allSettled([
    transporter.sendMail({
      from,
      to: order.customerEmail,
      subject: cust.subject,
      html: cust.html,
      text: cust.text,
      replyTo: adminTo,
    }),
    transporter.sendMail({
      from,
      to: adminTo,
      subject: adm.subject,
      html: adm.html,
      text: adm.text,
      replyTo: order.customerEmail,
    }),
  ]);

  const customerRes: SendResult['customer'] =
    custOutcome.status === 'fulfilled'
      ? { ok: true }
      : { ok: false, error: custOutcome.reason instanceof Error ? custOutcome.reason.message : String(custOutcome.reason) };
  if (!customerRes.ok) {
    console.error('[email] customer send failed', order.orderNumber, customerRes.error);
  }

  const adminRes: SendResult['admin'] =
    admOutcome.status === 'fulfilled'
      ? { ok: true }
      : { ok: false, error: admOutcome.reason instanceof Error ? admOutcome.reason.message : String(admOutcome.reason) };
  if (!adminRes.ok) {
    console.error('[email] admin send failed', order.orderNumber, adminRes.error);
  }

  return { customer: customerRes, admin: adminRes };
}
