import 'server-only';

// One-directional push to the internal operations hub: when an order is
// payment-verified, POST it to the hub's ingest API so the packing team sees
// it without anyone copying order lists around. Data flows out only — nothing
// is read back. Unconfigured envs make this a silent no-op (local dev).
//
// items[].sku carries our numeric product id as a string — the hub catalogue
// uses the same ids as SKUs, which is what links its stock tracking to ours.

export interface OpsHubOrderPayload {
  external_order_id: string;
  order_date: string; // ISO
  customer_name: string;
  customer_country: string;
  shipping_address: string;
  currency: string;
  total_paid: number; // dollars, not cents
  items: { sku: string; product_name: string; qty: number }[];
}

// Mirror a status change onto the hub so an order handled on THIS side
// doesn't sit on the hub board as NEW forever. Same secret, same
// best-effort/no-throw contract; the hub applies it forward-only.
export async function sendStatusToOpsHub(payload: {
  external_order_id: string;
  status: 'packing' | 'packed' | 'shipped' | 'cancelled';
  tracking_number?: string | null;
  carrier?: string | null;
}): Promise<void> {
  const url = process.env.OPS_HUB_INGEST_URL;
  const secret = process.env.OPS_HUB_INGEST_SECRET;
  if (!url || !secret) return;

  try {
    const res = await fetch(url.replace(/\/order\/?$/, '/order-status'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[ops-status]', payload.external_order_id, '→ HTTP', res.status, body.slice(0, 300));
    }
  } catch (e) {
    console.error('[ops-status]', payload.external_order_id, 'send failed:', e);
  }
}

export async function sendOrderToOpsHub(payload: OpsHubOrderPayload): Promise<void> {
  const url = process.env.OPS_HUB_INGEST_URL;
  const secret = process.env.OPS_HUB_INGEST_SECRET;
  if (!url || !secret) return;

  // Awaited by callers (serverless kills un-awaited work), but never throws:
  // the order flow must not fail because the ops hub is down. The hub dedupes
  // by external_order_id, so re-verifying a status later safely retries.
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[ops-ingest]', payload.external_order_id, '→ HTTP', res.status, body.slice(0, 300));
    }
  } catch (e) {
    console.error('[ops-ingest]', payload.external_order_id, 'send failed:', e);
  }
}
