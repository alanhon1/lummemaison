'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import { getStockFlagsMap, orderableCap, stockKey } from '@/lib/products/stock';
import { localePath } from '@/lib/i18n';
import type { ShippingSnapshot, DisclaimerAcceptance } from '@/lib/checkout/state';
import { computeShippingCents, isValidFedexAccount } from '@/lib/checkout/state';
import { sendOrderEmails, sendQuoteEmails, type OrderData } from '@/lib/email/sendOrderEmails';
import { findCountry } from '@/lib/countries';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { heicToJpegBuffer } from '@/lib/uploads/heicToJpeg';
import { isReservedPromoCode, bulkDiscountCents, qualifiesForBulk, BULK_MARKER } from '@/lib/checkout/bulk';
import { REF_COOKIE, normalizeReferralCode } from '@/lib/referrals';
import { notifyAdmin } from '@/lib/push/notify';

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
  option?: string;
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

// Customer-facing action: attach payment proof to an awaiting_payment (quoted)
// order. Ownership + status are verified with the user client before the
// service client writes, so no customer can touch another user's order.
export async function attachOrderPaymentProof(
  orderId: number,
  proofPath: string,
  transactionLink?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: o } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!o || o.status !== 'awaiting_payment') {
    return { ok: false, error: 'This order is not awaiting payment.' };
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from('orders')
    .update({
      payment_proof_path: (proofPath ?? '').trim(),
      payment_transaction_link: (transactionLink ?? '').trim().slice(0, 500),
    })
    .eq('id', orderId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Per-user order throttle (in-memory, per serverless instance). createOrder is
// auth-gated, but nothing stopped a signed-in user from scripting a flood of
// orders → transactional-email spam + junk rows. Cap to a sane human rate.
const ORDER_RL = new Map<string, { count: number; resetAt: number }>();
const ORDER_RL_MAX = 8;
const ORDER_RL_WINDOW_MS = 5 * 60 * 1000;

function orderRateLimited(userId: string): boolean {
  const now = Date.now();
  const e = ORDER_RL.get(userId);
  if (!e || now > e.resetAt) {
    ORDER_RL.set(userId, { count: 1, resetAt: now + ORDER_RL_WINDOW_MS });
    return false;
  }
  if (e.count >= ORDER_RL_MAX) return true;
  e.count++;
  return false;
}

export async function createOrder(input: CreateOrderInput, opts?: { quote?: boolean }): Promise<CreateOrderResult> {
  // Auth check — never create an order for an unauthenticated request.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'You must be signed in to place an order.' };
  }

  if (orderRateLimited(user.id)) {
    return { ok: false, error: 'Too many orders in a short time. Please wait a few minutes and try again.' };
  }

  if (input.items.length === 0) {
    return { ok: false, error: 'Your cart is empty.' };
  }

  // AUTHORITATIVE availability guard. The add-to-cart buttons block
  // notForSale/outOfStock products, but the cart persists in the browser
  // (localStorage, zustand `lumiere-cart`) with no server-side cart. An item
  // flagged AFTER it was added — or a product since deleted — would otherwise
  // sail straight through here. The client cart is NEVER trusted: re-check every
  // line against the live catalogue and refuse the whole order if any is blocked.
  // This is the one place that actually closes the "already in cart" bypass.
  const [liveProducts, optionStock] = await Promise.all([
    getAllProducts(),
    getStockFlagsMap(input.items.map(l => ({ product_id: l.product_id, option: l.option?.trim() || '' }))),
  ]);
  const liveById = new Map(liveProducts.map(p => [p.id, p]));
  // AUTHORITATIVE hard-cap guard. orderableCap folds every rule into one number
  // (notForSale / unavailable / stock_unknown / wonder ⇒ 0; else the real stock).
  // Refuse the whole order if any line's quantity exceeds its cap. This is the
  // one place that actually closes the "already in cart" / forged-cart bypass —
  // single-customer oversell can never get past here.
  const overCapLines = input.items.filter(l => {
    const flags = optionStock[stockKey(l.product_id, l.option?.trim() || '')];
    return l.quantity > orderableCap(liveById.get(l.product_id), flags);
  });
  if (overCapLines.length > 0) {
    const detail = overCapLines
      .map(l => {
        const flags = optionStock[stockKey(l.product_id, l.option?.trim() || '')];
        const cap = orderableCap(liveById.get(l.product_id), flags);
        const name = l.product_name + (l.option ? ` (${l.option})` : '');
        return cap <= 0
          ? `${name}: no longer available`
          : `${name}: only ${cap} available (your cart has ${l.quantity})`;
      })
      .join('; ');
    return {
      ok: false,
      error: `Some items exceed available stock — please adjust your cart before ordering: ${detail}`,
    };
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

  // Stock hard-cap is enforced above (orderableCap guard). The admin packaging
  // guard + DB floor (migration 034) remain as the deferred-concurrency net.

  // Payment screenshot is required (skipped for test orders).
  const proofPath = (input.paymentProofPath ?? '').trim();
  const transactionLink = (input.paymentTransactionLink ?? '').trim().slice(0, 500);
  if (!isTest && !opts?.quote && !proofPath) {
    return {
      ok: false,
      error: 'Please upload a payment screenshot before confirming.',
    };
  }

  // AUTHORITATIVE PRICING. Never trust the client-sent unit_cents (the cart
  // lives in localStorage and is fully forgeable). Re-derive every line's unit
  // price from the live catalogue — price is product-level, so options don't
  // change it. All money math AND persistence below use pricedItems, not the raw
  // input. (Lines past the block guard above are guaranteed present in liveById.)
  const pricedItems = input.items.map(l => ({
    ...l,
    unit_cents: Math.round((liveById.get(l.product_id)?.price ?? 0) * 100),
  }));

  const subtotal = pricedItems.reduce((sum, l) => sum + l.unit_cents * l.quantity, 0);
  const shipping = computeShippingCents(input.shipping);

  // Cap user-supplied text server-side regardless of what the form sent.
  const notes = (s.notes ?? '').trim().slice(0, 500);
  const discountCode = (s.discountCode ?? '').trim().slice(0, 64);

  // First-touch referral attribution (?ref=<code> landing, cookie set by
  // /api/ref/track). Applies to quotes too — a quote_pending order keeps its
  // referral when the admin later converts it.
  const referralCode = normalizeReferralCode((await cookies()).get(REF_COOKIE)?.value);

  const admin = createServiceClient();

  // Build bulk lines for potential quote discount — use the re-priced lines and
  // the correct catalogue field (categoryId, not category).
  const bulkLines = pricedItems.map(l => ({
    unitCents: l.unit_cents,
    quantity: l.quantity,
    categoryId: liveById.get(l.product_id)?.categoryId ?? null,
  }));

  // ── Quote branch (Option B: 15% off, $0 payment now, team quotes shipping) ──
  if (opts?.quote) {
    if (!qualifiesForBulk(subtotal)) {
      return { ok: false, error: 'A bulk quote requires a $2,500 or higher product subtotal.' };
    }
    const discountCents = bulkDiscountCents(bulkLines);
    const total = subtotal - discountCents;

    const { data: quoteOrder, error: quoteOrderError } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'quote_pending',
        subtotal_cents: subtotal,
        shipping_cents: 0,
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
        fedex_account: s.country === 'US' && isValidFedexAccount(s.fedexAccount) ? s.fedexAccount.trim() : null,
        payment_method: input.paymentMethod ?? null,
        notes: notes || null,
        discount_code: BULK_MARKER,
        referral_code: referralCode,
        payment_proof_path: null,
        payment_transaction_link: null,
        // TEST quotes get a TEST- number (no real order_seq consumed) and skip
        // emails/admin-notify below, mirroring the normal order branch.
        ...(isTest ? { order_seq: null, order_number: `TEST-${randomUUID().slice(0, 8).toUpperCase()}` } : {}),
      })
      .select('id, order_seq, view_token, order_number')
      .single();

    if (quoteOrderError || !quoteOrder) {
      return { ok: false, error: quoteOrderError?.message ?? 'Could not create the quote.' };
    }

    const quoteItemLines = pricedItems.map(l => ({
      order_id: quoteOrder.id,
      product_id: l.product_id,
      product_name: l.product_name,
      unit_cents: l.unit_cents,
      quantity: l.quantity,
      line_cents: l.unit_cents * l.quantity,
      option: l.option?.trim() || null,
    }));
    const { error: quoteItemsError } = await admin.from('order_items').insert(quoteItemLines);
    if (quoteItemsError) {
      await admin.from('orders').delete().eq('id', quoteOrder.id);
      return { ok: false, error: quoteItemsError.message };
    }

    const orderSeq = (quoteOrder.order_seq as number | null) ?? undefined;
    const viewToken = quoteOrder.view_token as string;
    const orderNumberDisplay =
      orderSeq != null ? formatOrderNumber(orderSeq) : (quoteOrder.order_number as string);

    if (!isTest) try {
      const countryName = findCountry(s.country)?.name ?? s.country;
      await sendQuoteEmails({
        orderNumber: orderNumberDisplay,
        orderSeq: orderSeq ?? 0,
        customerName: s.fullName,
        customerEmail: s.email,
        shippingAddress: {
          street: s.street,
          city: s.city,
          state_province: s.stateProvince,
          postal_code: s.postalCode,
          country: s.country,
          countryName,
        },
        subtotalCents: subtotal,
        discountCents,
        totalCents: total,
      });
    } catch (e) {
      console.error('[checkout] sendQuoteEmails threw', orderNumberDisplay, e);
    }

    // Admin inbox: a bulk quote request needs the owner's attention (best-effort,
    // skipped for TEST orders).
    if (!isTest) {
      await notifyAdmin({
        kind: 'order',
        title: `New bulk quote ${orderNumberDisplay}`,
        body: `${s.fullName} requested a quote — $${(total / 100).toFixed(2)}.`,
        url: `/manzura/orders/${quoteOrder.id}`,
        orderId: quoteOrder.id as number,
      });
    }

    return { ok: true, orderSeq, viewToken, orderNumber: orderNumberDisplay };
  }
  // ── End quote branch ──

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
      // Only persist a real 9-digit FedEx account; junk is dropped to null so it
      // can never sit on the order or affect pricing (shipping is computed by
      // computeShippingCents, which applies the same validity check).
      fedex_account: s.country === 'US' && isValidFedexAccount(s.fedexAccount) ? s.fedexAccount.trim() : null,
      payment_method: input.paymentMethod ?? null,
      notes: notes || null,
      discount_code: discountCode || null,
      referral_code: referralCode,
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

  const itemLines = pricedItems.map(l => ({
    order_id: order.id,
    product_id: l.product_id,
    product_name: l.product_name,
    unit_cents: l.unit_cents,
    quantity: l.quantity,
    line_cents: l.unit_cents * l.quantity,
    option: l.option?.trim() || null,
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
        option: l.option ?? undefined,
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

  // Admin inbox: surface the new order to the owner (best-effort). TEST orders
  // are excluded — same rule as the transactional emails above.
  if (!isTest) {
    await notifyAdmin({
      kind: 'order',
      title: `New order ${orderNumberDisplay}`,
      body: `${s.fullName} placed an order — $${(total / 100).toFixed(2)}.`,
      url: `/manzura/orders/${order.id}`,
      orderId: order.id as number,
    });
  }

  // Count the redemption only when the code actually applied (never for test
  // orders). Awaited — a fire-and-forget RPC can be frozen/killed after the
  // action returns, which silently dropped the count and let a capped code be
  // reused indefinitely. The RPC is now cap-aware (won't exceed max_uses).
  if (!isTest && discountCode && discountCents > 0) {
    const { error: incErr } = await admin.rpc('increment_promo_used_count', {
      p_code: discountCode.trim().toUpperCase(),
    });
    if (incErr && !incErr.message.includes('does not exist')) {
      console.warn('[checkout] promo increment failed', incErr.message);
    }
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
  if (isReservedPromoCode(code)) return 0; // BULK15 is server-only — never redeemable
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
    // Cap at the base so a misconfigured >100% code can't make the total negative.
    ? Math.min(Math.round((base * (promo.discount_value as number)) / 100), base)
    : Math.min(promo.discount_value as number, base);
}

// Client-callable preview: returns the discount a code would give. Pass the
// shipping so include_shipping codes preview the same amount checkout will charge.
export async function validatePromoCode(
  code: string,
  subtotalCents: number,
  shippingCents = 0,
): Promise<{ discountCents: number }> {
  if (isReservedPromoCode(code)) return { discountCents: 0 };
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

// Public server action for Option B bulk quote requests.
// Accepts the same JSON payload contract as placeOrderAction so the client can
// reuse the same payload builder — only the action endpoint differs.
export async function requestBulkQuoteAction(payload: string): Promise<CreateOrderResult> {
  let input: CreateOrderInput;
  try {
    input = JSON.parse(payload) as CreateOrderInput;
  } catch {
    return { ok: false, error: 'Invalid request payload.' };
  }
  return createOrder(input, { quote: true });
}
