'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import type { ShippingSnapshot, DisclaimerAcceptance } from '@/lib/checkout/state';
import { computeShippingCents } from '@/lib/checkout/state';
import { sendOrderEmails, type OrderData } from '@/lib/email/sendOrderEmails';
import { findCountry } from '@/lib/countries';
import { getStockMap } from '@/lib/products/stock';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { heicToJpegBuffer } from '@/lib/uploads/heicToJpeg';

const PROOF_BUCKET = 'payment-proofs';
const PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PROOF_ACCEPT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export interface CartLineInput {
  product_id: number;
  product_name: string;
  unit_cents: number;
  quantity: number;
}

export interface CreateOrderInput {
  locale: string;
  shipping: ShippingSnapshot;
  disclaimers: DisclaimerAcceptance;
  items: CartLineInput[];
  paymentMethod?: 'wise' | 'usdt';
  paymentProofPath?: string;
  paymentTransactionLink?: string;
}

export interface CreateOrderResult {
  ok: boolean;
  orderSeq?: number;
  viewToken?: string;
  orderNumber?: string;
  error?: string;
  test?: boolean; // hidden test order (FedEx "ALANTEST") — nothing persisted
}

export interface UploadProofResult {
  ok: boolean;
  path?: string;
  error?: string;
}

// Validates and stores a payment-proof file in the private `payment-proofs`
// bucket. Called by the payment step BEFORE the customer submits the order,
// so we don't yet have an order id — the path is keyed by user id + a uuid,
// then attached to the order on confirm.
export async function uploadPaymentProof(formData: FormData): Promise<UploadProofResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to upload.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file received.' };
  }
  if (file.size > PROOF_MAX_BYTES) {
    return { ok: false, error: `File is larger than 10 MB.` };
  }
  const ext = PROOF_ACCEPT[file.type];
  if (!ext) {
    return {
      ok: false,
      error: 'Unsupported file type. Please upload a PNG, JPG, WEBP, HEIC, or PDF.',
    };
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let storedExt = ext;

  // HEIC/HEIF → JPG so Windows/Chrome admin previews always work.
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    try {
      buffer = await heicToJpegBuffer(buffer);
    } catch (e) {
      console.error('[checkout] HEIC conversion failed', e);
      return { ok: false, error: 'Could not convert HEIC image. Please upload PNG or JPG instead.' };
    }
    contentType = 'image/jpeg';
    storedExt = 'jpg';
  }

  const admin = createServiceClient();
  const objectKey = `${user.id}/${randomUUID()}.${storedExt}`;
  const { error: uploadError } = await admin.storage
    .from(PROOF_BUCKET)
    .upload(objectKey, buffer, {
      contentType,
      upsert: false,
    });
  if (uploadError) {
    console.error('[checkout] proof upload failed', uploadError);
    return { ok: false, error: uploadError.message };
  }

  return { ok: true, path: objectKey };
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  // Auth check — never create an order for an unauthenticated request.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'You must be signed in to place an order.' };
  }

  if (input.items.length === 0) {
    return { ok: false, error: 'Your cart is empty.' };
  }
  if (
    !input.disclaimers.shipping ||
    !input.disclaimers.delivery ||
    !input.disclaimers.stock ||
    !input.disclaimers.temperatureSensitive ||
    !input.disclaimers.fragileItems
  ) {
    return { ok: false, error: 'Please accept all policy disclaimers before placing the order.' };
  }
  const s = input.shipping;
  if (!s.fullName || !s.email || !s.phone || !s.country || !s.street || !s.city || !s.postalCode) {
    return { ok: false, error: 'Shipping details are incomplete.' };
  }

  // Hidden test mode: postal/ZIP code "ALANTEST" creates a TEST order. It DOES
  // show in the admin orders list — as "TEST-xxxx" (order_seq null, so no real
  // #5000 number is consumed) — but is excluded from stock, analytics, exports
  // and emails. Identified everywhere by the order_number "TEST-" prefix. Works
  // for any country since the postal code field is always present.
  const isTest = (s.postalCode ?? '').trim().toUpperCase() === 'ALANTEST';

  // Re-validate stock against the live counts before creating the order — the
  // cart is persisted client-side and may be stale (item sold out, or fewer
  // units left than requested). Test orders bypass real inventory entirely.
  if (!isTest) {
    const stockMap = await getStockMap(input.items.map(i => i.product_id));
    const offending = input.items.find(i => (stockMap[i.product_id] ?? 0) < i.quantity);
    if (offending) {
      const available = stockMap[offending.product_id] ?? 0;
      return {
        ok: false,
        error:
          available === 0
            ? `${offending.product_name} is sold out. Please remove it from your cart.`
            : `${offending.product_name} is no longer available in the requested quantity. Please reduce the amount.`,
      };
    }
  }

  // Payment screenshot is required (skipped for test orders).
  const proofPath = (input.paymentProofPath ?? '').trim();
  const transactionLink = (input.paymentTransactionLink ?? '').trim().slice(0, 500);
  if (!isTest && !proofPath) {
    return {
      ok: false,
      error: 'Please upload a payment screenshot before confirming.',
    };
  }

  const subtotal = input.items.reduce((sum, l) => sum + l.unit_cents * l.quantity, 0);
  const shipping = computeShippingCents(input.shipping);

  // Cap user-supplied text server-side regardless of what the form sent.
  const notes = (s.notes ?? '').trim().slice(0, 500);
  const discountCode = (s.discountCode ?? '').trim().slice(0, 64);

  const admin = createServiceClient();

  // Discount base is the products subtotal (or subtotal + shipping for an
  // include_shipping promo); the real shipping is still added to the total.
  const discountCents = await promoDiscountCents(admin, discountCode, subtotal, shipping);
  const total = subtotal + shipping - discountCents;

  // order_seq, order_number, view_token are populated by DB column defaults
  // and the BEFORE INSERT trigger (see supabase/migrations/002_order_seq.sql).
  // The Postgres sequence guarantees uniqueness without app-level retries.
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'order_received',
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      total_cents: total,
      currency: 'USD',
      shipping_address: {
        street: s.street,
        city: s.city,
        state_province: s.stateProvince,
        postal_code: s.postalCode,
        country: s.country,
      },
      customer_name: s.fullName,
      customer_email: s.email,
      customer_phone: s.phone,
      fedex_account: s.country === 'US' ? s.fedexAccount.trim() || null : null,
      payment_method: input.paymentMethod ?? null,
      notes: notes || null,
      discount_code: discountCode || null,
      payment_proof_path: proofPath || null,
      payment_transaction_link: transactionLink || null,
      // Test orders skip the real sequence and get a "TEST-" number so they're
      // visible in admin but excluded from stock/analytics/exports by prefix.
      ...(isTest ? { order_seq: null, order_number: `TEST-${randomUUID().slice(0, 8).toUpperCase()}` } : {}),
    })
    .select('id, order_seq, view_token, order_number')
    .single();

  if (orderError) {
    return { ok: false, error: orderError.message };
  }

  const itemLines = input.items.map(l => ({
    order_id: order.id,
    product_id: l.product_id,
    product_name: l.product_name,
    unit_cents: l.unit_cents,
    quantity: l.quantity,
    line_cents: l.unit_cents * l.quantity,
  }));
  const { error: itemsError } = await admin.from('order_items').insert(itemLines);
  if (itemsError) {
    // Roll back the order so we don't leave a header without items.
    await admin.from('orders').delete().eq('id', order.id);
    return { ok: false, error: itemsError.message };
  }

  // Stock is deducted when admin confirms payment (payment_verified step),
  // not at order creation — see app/manzura/orders/actions.ts.

  const orderSeq = (order.order_seq as number | null) ?? undefined;
  const viewToken = order.view_token as string;
  const orderNumberDisplay = orderSeq != null ? formatOrderNumber(orderSeq) : (order.order_number as string);

  // Fire transactional emails — but NOT for test orders (no order@ / admin mail).
  // Wrapped so a send failure never breaks the order.
  if (!isTest) try {
    const countryName =
      findCountry(input.shipping.country)?.name ?? input.shipping.country;
    const payload: OrderData = {
      orderNumber: orderNumberDisplay,
      customerName: s.fullName,
      customerEmail: s.email,
      customerPhone: s.phone,
      shippingAddress: {
        street: s.street,
        city: s.city,
        state_province: s.stateProvince,
        postal_code: s.postalCode,
        country: s.country,
        countryName,
      },
      country: countryName,
      items: itemLines.map(l => ({
        name: l.product_name,
        quantity: l.quantity,
        price: l.unit_cents,
      })),
      subtotal,
      shipping,
      total,
      currency: 'USD',
      notes: notes || undefined,
      discountCode: discountCode || undefined,
      status: 'order_received',
      transactionLink: transactionLink || undefined,
      proofPath: proofPath || undefined,
    };
    await sendOrderEmails(payload);
  } catch (e) {
    console.error('[checkout] sendOrderEmails threw', orderNumberDisplay, e);
  }

  // Fire-and-forget: increment used_count only when the code actually applied
  // (never for test orders).
  if (!isTest && discountCode && discountCents > 0) {
    void admin
      .rpc('increment_promo_used_count', { p_code: discountCode.trim().toUpperCase() })
      .then(({ error }) => {
        if (error && !error.message.includes('does not exist')) {
          console.warn('[checkout] promo increment failed', error.message);
        }
      });
  }

  return {
    ok: true,
    orderSeq,
    viewToken,
    orderNumber: orderNumberDisplay,
    test: isTest,
  };
}

// Promo lookup → discount in cents. The discount base is the products subtotal
// by default; a promo flagged `include_shipping` discounts subtotal + shipping
// instead. The minimum-order check is always against the products subtotal.
// Returns 0 for invalid/inactive/expired/used-up/below-minimum.
async function promoDiscountCents(
  admin: ReturnType<typeof createServiceClient>,
  code: string,
  subtotalCents: number,
  shippingCents: number,
): Promise<number> {
  const c = (code ?? '').trim();
  if (!c) return 0;
  const { data: promo } = await admin
    .from('promo_codes')
    .select('discount_type, discount_value, min_order_cents, max_uses, used_count, active, expires_at, include_shipping')
    .ilike('code', c)
    .maybeSingle();
  if (!promo || !promo.active) return 0;
  if (promo.expires_at != null && new Date(promo.expires_at as string) <= new Date()) return 0;
  if (promo.max_uses != null && (promo.used_count as number) >= (promo.max_uses as number)) return 0;
  if (subtotalCents < (promo.min_order_cents as number)) return 0;
  const base = promo.include_shipping ? subtotalCents + shippingCents : subtotalCents;
  return promo.discount_type === 'percent'
    ? Math.round((base * (promo.discount_value as number)) / 100)
    : Math.min(promo.discount_value as number, base);
}

// Client-callable preview: returns the discount a code would give. Pass the
// shipping so include_shipping codes preview the same amount checkout will charge.
export async function validatePromoCode(
  code: string,
  subtotalCents: number,
  shippingCents = 0,
): Promise<{ discountCents: number }> {
  const admin = createServiceClient();
  return { discountCents: await promoDiscountCents(admin, code, subtotalCents, shippingCents) };
}

// Convenience server action used by the payment step's "Confirm Order" form.
// Receives the draft + cart serialised as JSON in a hidden field.
export async function placeOrderAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'en');
  const payload = String(formData.get('payload') ?? '');
  let input: CreateOrderInput;
  try {
    input = JSON.parse(payload) as CreateOrderInput;
  } catch {
    redirect(`${localePath(locale, '/checkout/payment')}?error=bad-payload`);
  }
  const result = await createOrder(input);
  if (result.ok && result.test && result.orderNumber && result.viewToken) {
    // Test order persisted as TEST-xxxx — show its confirmation by order_number.
    redirect(`${localePath(locale, `/checkout/confirmation/${result.orderNumber}`)}?t=${result.viewToken}`);
  }
  if (!result.ok || result.orderSeq === undefined || !result.viewToken) {
    const message = encodeURIComponent(result.error ?? 'unknown');
    redirect(`${localePath(locale, '/checkout/payment')}?error=${message}`);
  }
  redirect(
    `${localePath(locale, `/checkout/confirmation/${result.orderSeq}`)}?t=${result.viewToken}`,
  );
}
