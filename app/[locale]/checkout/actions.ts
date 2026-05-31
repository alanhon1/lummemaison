'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ShippingSnapshot, DisclaimerAcceptance } from '@/lib/checkout/state';
import { computeShippingCents } from '@/lib/checkout/state';

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
}

export interface CreateOrderResult {
  ok: boolean;
  orderNumber?: string;
  error?: string;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Generates LM-YYYYMMDD-XXXX where XXXX is the next 4-digit sequence number
// for today, using a count query as a starting point. If two requests race
// and both pick the same number, the unique constraint on orders.order_number
// rejects one and we retry with the next sequence.
async function nextOrderNumber(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  prefix: string,
): Promise<string> {
  const { count, error } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .ilike('order_number', `${prefix}%`);
  if (error) throw new Error(`Failed to compute next order number: ${error.message}`);
  const seq = (count ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
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
    !input.disclaimers.stock
  ) {
    return { ok: false, error: 'Please accept all three policy disclaimers before placing the order.' };
  }
  const s = input.shipping;
  if (!s.fullName || !s.email || !s.phone || !s.country || !s.street || !s.city || !s.postalCode) {
    return { ok: false, error: 'Shipping details are incomplete.' };
  }

  const subtotal = input.items.reduce((sum, l) => sum + l.unit_cents * l.quantity, 0);
  const shipping = computeShippingCents(input.shipping);
  const total = subtotal + shipping;

  const admin = createServiceClient();
  const prefix = `LM-${todayYYYYMMDD()}-`;

  // Try a few candidates to absorb race-condition collisions on the order
  // number. Each iteration recomputes the sequence so a second collision
  // moves us forward rather than retrying the same number.
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = await nextOrderNumber(admin, prefix);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        status: 'pending',
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
      })
      .select('id')
      .single();

    if (orderError) {
      if (orderError.code === '23505') {
        // Unique violation on order_number — race lost; recompute and retry.
        lastError = orderError.message;
        continue;
      }
      return { ok: false, error: orderError.message };
    }

    const { error: itemsError } = await admin.from('order_items').insert(
      input.items.map(l => ({
        order_id: order.id,
        product_id: l.product_id,
        product_name: l.product_name,
        unit_cents: l.unit_cents,
        quantity: l.quantity,
        line_cents: l.unit_cents * l.quantity,
      })),
    );
    if (itemsError) {
      // Roll back the order so we don't leave a header without items.
      await admin.from('orders').delete().eq('id', order.id);
      return { ok: false, error: itemsError.message };
    }

    return { ok: true, orderNumber };
  }

  return {
    ok: false,
    error: `Could not allocate an order number after retries (${lastError ?? 'unknown'}).`,
  };
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
    redirect(`/${locale}/checkout/payment?error=bad-payload`);
  }
  const result = await createOrder(input);
  if (!result.ok || !result.orderNumber) {
    const message = encodeURIComponent(result.error ?? 'unknown');
    redirect(`/${locale}/checkout/payment?error=${message}`);
  }
  redirect(`/${locale}/checkout/confirmation/${result.orderNumber}`);
}
