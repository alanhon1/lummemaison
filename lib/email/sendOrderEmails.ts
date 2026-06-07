import { getTransporter } from './mailer';
import {
  customerEmail,
  adminEmail,
  shipmentEmail,
  cancellationEmail,
  deliveryEmail,
  signupConfirmationEmail,
  passwordResetCodeEmail,
  paymentVerifiedEmail,
  lowStockAlertEmail,
  type OrderData,
  type ShipmentData,
  type CancellationData,
  type DeliveryData,
  type SignupConfirmData,
  type PasswordResetCodeData,
  type PaymentVerifiedData,
  type LowStockAlertData,
} from './templates';
import { createServiceClient } from '@/lib/supabase/server';

export type { OrderData, ShipmentData, CancellationData, DeliveryData, SignupConfirmData, PasswordResetCodeData, PaymentVerifiedData, LowStockAlertData } from './templates';

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
      replyTo: order.status === 'order_received' ? from : adminTo,
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

// Sends the customer-facing shipment-notification email. Used by the admin
// "mark shipped" server action. Never throws — admin-side ship action proceeds
// regardless. Returns ok/error per the same shape so the action can surface it.
export async function sendShipmentEmail(s: ShipmentData): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const reason = 'SMTP_FROM missing';
    console.warn(`[email] ${reason} — skipping shipment email for`, s.orderNumber);
    return { ok: false, error: reason };
  }

  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] transporter init failed', s.orderNumber, msg);
    return { ok: false, error: msg };
  }

  const rendered = shipmentEmail(s);
  try {
    await transporter.sendMail({
      from,
      to: s.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.ADMIN_NOTIFICATION_EMAIL,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] shipment send failed', s.orderNumber, msg);
    return { ok: false, error: msg };
  }
}

// Same shape as sendShipmentEmail — fires the customer-facing delivery
// confirmation when admin marks an order as `delivered`. Never throws.
export async function sendDeliveryEmail(d: DeliveryData): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const reason = 'SMTP_FROM missing';
    console.warn(`[email] ${reason} — skipping delivery email for`, d.orderNumber);
    return { ok: false, error: reason };
  }

  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] transporter init failed', d.orderNumber, msg);
    return { ok: false, error: msg };
  }

  const rendered = deliveryEmail(d);
  try {
    await transporter.sendMail({
      from,
      to: d.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.ADMIN_NOTIFICATION_EMAIL,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] delivery send failed', d.orderNumber, msg);
    return { ok: false, error: msg };
  }
}

// Generic single-recipient sender used by the auth-flow emails (signup
// confirmation, password reset code). Same env-guard + transporter pattern
// as the order emails; logs failures, never throws.
async function sendOne(
  to: string,
  rendered: { subject: string; html: string; text: string },
  context: string,
): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const reason = 'SMTP_FROM missing';
    console.warn(`[email] ${reason} — skipping ${context} for`, to);
    return { ok: false, error: reason };
  }
  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] transporter init failed', context, to, msg);
    return { ok: false, error: msg };
  }
  try {
    await transporter.sendMail({
      from, to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.ADMIN_NOTIFICATION_EMAIL,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email] ${context} send failed`, to, msg);
    return { ok: false, error: msg };
  }
}

export async function sendSignupConfirmationEmail(s: SignupConfirmData): Promise<{ ok: boolean; error?: string }> {
  return sendOne(s.customerEmail, signupConfirmationEmail(s), 'signup-confirm');
}

export async function sendPasswordResetCodeEmail(s: PasswordResetCodeData): Promise<{ ok: boolean; error?: string }> {
  return sendOne(s.customerEmail, passwordResetCodeEmail(s), 'password-reset-code');
}

// Fires the customer-facing payment-verified notification when admin confirms
// payment. Uses sendOne with customer email as recipient. Never throws.
export async function sendPaymentVerifiedEmail(d: PaymentVerifiedData): Promise<{ ok: boolean; error?: string }> {
  return sendOne(d.customerEmail, paymentVerifiedEmail(d), 'payment-verified');
}

// Fires the admin-facing low-stock alert after stock is deducted. Sends to
// ADMIN_NOTIFICATION_EMAIL. Never throws.
export async function sendLowStockAlert(d: LowStockAlertData): Promise<{ ok: boolean; error?: string }> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn('[email] ADMIN_NOTIFICATION_EMAIL missing — skipping low-stock alert');
    return { ok: false, error: 'ADMIN_NOTIFICATION_EMAIL missing' };
  }
  return sendOne(to, lowStockAlertEmail(d), 'low-stock-alert');
}

// Same shape as sendShipmentEmail — fires the customer-facing cancellation
// notice when admin transitions an order to `cancelled`. Never throws.
export async function sendCancellationEmail(c: CancellationData): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const reason = 'SMTP_FROM missing';
    console.warn(`[email] ${reason} — skipping cancellation email for`, c.orderNumber);
    return { ok: false, error: reason };
  }

  let transporter: ReturnType<typeof getTransporter>;
  try {
    transporter = getTransporter();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] transporter init failed', c.orderNumber, msg);
    return { ok: false, error: msg };
  }

  const rendered = cancellationEmail(c);
  try {
    await transporter.sendMail({
      from,
      to: c.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.ADMIN_NOTIFICATION_EMAIL,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] cancellation send failed', c.orderNumber, msg);
    return { ok: false, error: msg };
  }
}
