import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { stageIndex, type OrderStatus } from '@/lib/orders/status';
import { carrierLabel, carrierTrackUrl, isCarrierKey, type CarrierKey } from '@/lib/orders/carriers';
import { sendShipmentEmail } from '@/lib/email/sendOrderEmails';
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
  if (!url) return { checked: 0, applied: 0, skipped: [] };

  let hubOrders: HubOrder[] = [];
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.OPS_HUB_INGEST_SECRET}` },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return { checked: 0, applied: 0, skipped: [`hub HTTP ${res.status}`] };
    const body = (await res.json()) as { ok?: boolean; orders?: HubOrder[] };
    hubOrders = body.orders ?? [];
  } catch (e) {
    return { checked: 0, applied: 0, skipped: [`hub unreachable: ${String(e).slice(0, 120)}`] };
  }

  const actionable = hubOrders.filter(o => PACK_TARGETS.has(o.status) || o.status === 'SHIPPED');
  if (actionable.length === 0) return { checked: hubOrders.length, applied: 0, skipped: [] };

  const supabase = createServiceClient();
  const result: OpsSyncResult = { checked: hubOrders.length, applied: 0, skipped: [] };

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
      const step = await updateOrderStatus(order.id as number, 'packaging');
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
      const { error: shipErr } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          carrier,
          tracking_number: tracking,
          shipped_at: hub.shipped_at ?? new Date().toISOString(),
        })
        .eq('id', order.id)
        .neq('status', 'shipped');
      if (shipErr) {
        result.skipped.push(`${hub.external_order_id}: ship update failed — ${shipErr.message}`);
        continue;
      }
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
