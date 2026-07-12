import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { stageIndex, type OrderStatus } from '@/lib/orders/status';
import { carrierLabel, carrierTrackUrl, isCarrierKey, type CarrierKey } from '@/lib/orders/carriers';
import { findCountry } from '@/lib/countries';
import { sendShipmentEmail } from '@/lib/email/sendOrderEmails';
import { sendOrderToOpsHub, sendStatusToOpsHub } from '@/lib/ops/ingest';
import { updateOrderStatus } from '@/app/manzura/orders/actions';

// Pull-based status sync from the ops hub. The hub never calls us and never
// stores anything about this site — we ask it (same bearer secret as the
// ingest push) what state our pushed orders are in, then move our own rows
// forward to match:
//
//   hub PACKING / PACKED  → packaging   (via updateOrderStatus — reuses the
//                                        stock deduction + oversell guard)
//   hub SHIPPED           → shipped     (carrier + tracking from the hub; no
//                                        shipment photo on this path)
//
// Forward-only: a site order is never moved backwards, and cancellations are
// deliberately NOT synced — cancelling a customer order stays a human call.

type HubOrder = {
  external_order_id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
};

export type OpsSyncResult = {
  checked: number;
  applied: number;
  repushed: number; // paid orders the hub was missing (e.g. it was down at payment time)
  skipped: string[]; // human-readable reasons, surfaced in server logs
};

const PACK_TARGETS = new Set(['PACKING', 'PACKED']);

function statusUrl(): string | null {
  const ingest = process.env.OPS_HUB_INGEST_URL;
  if (!ingest || !process.env.OPS_HUB_INGEST_SECRET) return null;
  return ingest.replace(/\/order\/?$/, '/status');
}

function normalizeCarrier(raw: string | null): CarrierKey {
  const key = (raw ?? '').trim().toLowerCase();
  return isCarrierKey(key) ? key : 'fedex';
}

export async function syncOrderStatusFromOpsHub(): Promise<OpsSyncResult> {
  const url = statusUrl();
  if (!url) return { checked: 0, applied: 0, repushed: 0, skipped: [] };

  let hubOrders: HubOrder[] = [];
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.OPS_HUB_INGEST_SECRET}` },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return { checked: 0, applied: 0, repushed: 0, skipped: [`hub HTTP ${res.status}`] };
    const body = (await res.json()) as { ok?: boolean; orders?: HubOrder[] };
    hubOrders = body.orders ?? [];
  } catch (e) {
    return { checked: 0, applied: 0, repushed: 0, skipped: [`hub unreachable: ${String(e).slice(0, 120)}`] };
  }

  const supabase = createServiceClient();
  const result: OpsSyncResult = { checked: hubOrders.length, applied: 0, repushed: 0, skipped: [] };

  // Self-heal the push side: any recent paid order the hub doesn't know about
  // (it was down / erroring when payment_verified fired) gets re-pushed now.
  await repushMissingOrders(supabase, new Set(hubOrders.map(o => o.external_order_id)), result);

  const actionable = hubOrders.filter(o => PACK_TARGETS.has(o.status) || o.status === 'SHIPPED');

  for (const hub of actionable) {
    // external_order_id is our display number: "SGL #005123" (or a legacy
    // LM-… order_number for very old rows).
    const seqMatch = hub.external_order_id.match(/^SGL #(\d+)$/);
    const lookup = supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, customer_email, carrier, tracking_number');
    const { data: order } = seqMatch
      ? await lookup.eq('order_seq', Number(seqMatch[1])).maybeSingle()
      : await lookup.eq('order_number', hub.external_order_id).maybeSingle();
    if (!order) {
      result.skipped.push(`${hub.external_order_id}: no matching site order`);
      continue;
    }

    const current = order.status as OrderStatus;
    const currentIdx = stageIndex(current);
    if (current === 'cancelled' || currentIdx >= stageIndex('shipped')) continue; // nothing to do
    if (currentIdx < stageIndex('payment_verified')) {
      // Hub only ever receives paid orders; a site row still before
      // payment_verified means an admin rolled it back — don't fight them.
      result.skipped.push(`${hub.external_order_id}: site is at ${current}, not syncing`);
      continue;
    }

    // Step 1 — packaging (both for PACKING/PACKED and as the stock-deducting
    // stepping stone on the way to shipped).
    if (currentIdx < stageIndex('packaging')) {
      // A deliberate admin rollback (packaging → payment_verified) leaves
      // cancelled/cancel_restock movements behind. Re-advancing it here would
      // defeat the admin and re-deduct stock — leave those to a human.
      const { data: rolledBack } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('order_id', order.id)
        .in('reason', ['cancelled', 'cancel_restock'])
        .limit(1);
      if ((rolledBack?.length ?? 0) > 0) {
        result.skipped.push(`${hub.external_order_id}: site was rolled back by an admin — not re-advancing`);
        continue;
      }
      const step = await updateOrderStatus(order.id as number, 'packaging', { skipOpsMirror: true });
      if (!step.ok) {
        result.skipped.push(`${hub.external_order_id}: packaging blocked — ${step.error}`);
        continue;
      }
      result.applied += 1;
    }

    // Step 2 — shipped (hub requires tracking before its own SHIPPED flip).
    if (hub.status === 'SHIPPED') {
      const tracking = (hub.tracking_number ?? '').trim();
      if (!tracking) {
        result.skipped.push(`${hub.external_order_id}: hub shipped without tracking`);
        continue;
      }
      const carrier = normalizeCarrier(hub.carrier);
      const { data: shipped, error: shipErr } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          carrier,
          tracking_number: tracking,
          shipped_at: hub.shipped_at ?? new Date().toISOString(),
        })
        .eq('id', order.id)
        .neq('status', 'shipped')
        .select('id');
      if (shipErr) {
        result.skipped.push(`${hub.external_order_id}: ship update failed — ${shipErr.message}`);
        continue;
      }
      // Zero rows = another sync pass shipped it first — its email already
      // went out; sending again would double-notify the customer.
      if (!shipped?.length) continue;
      result.applied += 1;

      const orderNumber =
        order.order_seq != null ? formatOrderNumber(order.order_seq as number) : (order.order_number as string);
      try {
        await sendShipmentEmail({
          orderNumber,
          customerName: order.customer_name as string,
          customerEmail: order.customer_email as string,
          carrierLabel: carrierLabel(carrier),
          trackingNumber: tracking,
          trackingUrl: carrierTrackUrl(carrier, tracking) ?? undefined,
        });
      } catch (e) {
        console.error('[ops-sync] shipment email failed for', orderNumber, e);
      }
    }
  }

  if (result.skipped.length) console.warn('[ops-sync] skipped:', result.skipped);
  return result;
}

// Push-side self-heal: rebuild and resend any paid order (last 30 days) the
// hub has no row for. The hub dedupes by external_order_id, so this can never
// double-create; afterwards the order's current progress is mirrored too so
// it doesn't land as NEW when it's actually being packed or already shipped.
async function repushMissingOrders(
  supabase: ReturnType<typeof createServiceClient>,
  hubKnown: Set<string>,
  result: OpsSyncResult,
): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: siteOrders } = await supabase
    .from('orders')
    .select('id, order_seq, order_number, status, customer_name, currency, total_cents, created_at, shipping_address, tracking_number, carrier')
    .gte('created_at', since)
    .in('status', ['payment_verified', 'packaging', 'shipped', 'delivered'])
    .limit(500);

  for (const o of (siteOrders ?? []) as Array<{
    id: number; order_seq: number | null; order_number: string; status: string;
    customer_name: string; currency: string | null; total_cents: number | null; created_at: string;
    shipping_address: { street?: string; city?: string; state_province?: string; postal_code?: string; country?: string } | null;
    tracking_number: string | null; carrier: string | null;
  }>) {
    const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
    if (display.toUpperCase().startsWith('TEST-')) continue;
    if (hubKnown.has(display)) continue;

    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, quantity, option')
      .eq('order_id', o.id);
    const lines = (items ?? []) as Array<{ product_id: number; product_name: string; quantity: number; option: string | null }>;
    if (lines.length === 0) continue;

    const addr = o.shipping_address ?? {};
    const countryName = addr.country ? findCountry(addr.country)?.name ?? addr.country : '';
    await sendOrderToOpsHub({
      external_order_id: display,
      order_date: o.created_at,
      customer_name: o.customer_name ?? '',
      customer_country: countryName,
      shipping_address: [addr.street, addr.city, addr.state_province, addr.postal_code, countryName]
        .filter(Boolean)
        .join(', '),
      currency: o.currency ?? 'USD',
      total_paid: (o.total_cents ?? 0) / 100,
      items: lines.map(i => ({
        sku: String(i.product_id),
        product_name: i.option ? `${i.product_name} (${i.option})` : i.product_name,
        qty: i.quantity,
      })),
    });
    result.repushed += 1;

    // Bring the fresh hub row up to the order's real progress.
    if (o.status === 'packaging') {
      await sendStatusToOpsHub({ external_order_id: display, status: 'packing' });
    } else if (o.status === 'shipped' || o.status === 'delivered') {
      await sendStatusToOpsHub({
        external_order_id: display,
        status: 'shipped',
        tracking_number: o.tracking_number,
        carrier: carrierLabel(o.carrier),
      });
    }
  }
  if (result.repushed > 0) console.warn('[ops-sync] re-pushed', result.repushed, 'missing order(s) to the hub');
}
