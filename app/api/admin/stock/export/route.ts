import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import * as XLSX from 'xlsx';

function toKstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function kstDateToUtcStart(d: string): string {
  return new Date(`${d}T00:00:00+09:00`).toISOString();
}
function kstDateToUtcEnd(d: string): string {
  return new Date(`${d}T23:59:59+09:00`).toISOString();
}

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'stock';

  const supabase = createServiceClient();
  const allProducts = await getAllProducts();
  const productById = new Map(allProducts.map(p => [p.id, p.name as string]));

  let filename = 'stock-export.xlsx';
  let rows: Record<string, unknown>[] = [];

  // ── STOCK TYPE ────────────────────────────────────────────────
  if (type === 'stock') {
    filename = `stock-current-${toKstDate(new Date().toISOString())}.xlsx`;
    const { data: stockRows } = await supabase
      .from('product_stock')
      .select('product_id, stock')
      .order('product_id');

    const stockMap = new Map((stockRows ?? []).map(r => [r.product_id as number, r.stock as number]));

    rows = allProducts.map(p => {
      const stock = stockMap.get(p.id) ?? 0;
      return {
        'Product ID': p.id,
        'Product Name': p.name,
        'Current Stock': stock,
        Status: stock <= 0 ? 'Sold out' : stock <= 3 ? 'Low' : 'OK',
      };
    });
  }

  // ── HISTORY TYPE ──────────────────────────────────────────────
  else if (type === 'history') {
    const pid     = searchParams.get('pid')    ?? '';
    const from    = searchParams.get('from')   ?? '';
    const to      = searchParams.get('to')     ?? '';
    const reason  = searchParams.get('reason') ?? '';
    const cid     = searchParams.get('cid')    ?? '';
    const date    = searchParams.get('date')   ?? '';

    filename = `stock-history-${toKstDate(new Date().toISOString())}.xlsx`;

    let query = supabase
      .from('stock_movements')
      .select('id, product_id, delta, reason, note, created_at, companies(name), orders(order_seq, order_number)')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (pid)    query = query.eq('product_id', Number(pid));
    if (reason) query = query.eq('reason', reason);
    if (cid)    query = query.eq('company_id', Number(cid));
    if (date) {
      query = query.gte('created_at', kstDateToUtcStart(date)).lte('created_at', kstDateToUtcEnd(date));
    } else {
      if (from) query = query.gte('created_at', kstDateToUtcStart(from));
      if (to)   query = query.lte('created_at', kstDateToUtcEnd(to));
    }

    const { data: movements } = await query;
    const typedMovements = (movements ?? []) as unknown as Array<{
      id: number; product_id: number; delta: number; reason: string;
      note: string | null; created_at: string;
      companies: { name: string } | null;
      orders: { order_seq: number | null; order_number: string } | null;
    }>;

    const REASON_LABEL: Record<string, string> = {
      inbound: 'Inbound', order: 'Order',
      cancel_restock: 'Cancel +stock', adjustment: 'Adjustment',
    };

    rows = typedMovements.map(m => {
      let ref = '';
      if (m.companies?.name) ref = m.companies.name;
      if (m.orders) {
        const seq = m.orders.order_seq;
        ref = seq != null ? formatOrderNumber(seq) : m.orders.order_number;
      }
      return {
        Date:         toKstDate(m.created_at),
        'Product ID': m.product_id,
        Product:      productById.get(m.product_id) ?? `#${m.product_id}`,
        'Δ Qty':      m.delta,
        Reason:       REASON_LABEL[m.reason] ?? m.reason,
        Reference:    ref,
        Note:         m.note ?? '',
      };
    });
  }

  // ── ORDERS TYPE ───────────────────────────────────────────────
  else if (type === 'orders') {
    const from   = searchParams.get('from')   ?? '';
    const to     = searchParams.get('to')     ?? '';
    const status = searchParams.get('reason') ?? '';

    filename = `stock-orders-${toKstDate(new Date().toISOString())}.xlsx`;

    let ordersQuery = supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, customer_email, customer_phone, total_cents, currency, created_at, shipping_address, user_id')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (status) ordersQuery = ordersQuery.eq('status', status);
    if (from)   ordersQuery = ordersQuery.gte('created_at', kstDateToUtcStart(from));
    if (to)     ordersQuery = ordersQuery.lte('created_at', kstDateToUtcEnd(to));

    const { data: ordersRaw } = await ordersQuery;
    const orders = (ordersRaw ?? []) as Array<{
      id: number; order_seq: number | null; order_number: string;
      status: string; customer_name: string; customer_email: string;
      customer_phone: string; total_cents: number; currency: string;
      created_at: string; shipping_address: Record<string, string> | null; user_id: string;
    }>;

    // Items
    const orderIds = orders.map(o => o.id);
    const itemsByOrder = new Map<number, string>();
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity')
        .in('order_id', orderIds);
      for (const it of items ?? []) {
        const prev = itemsByOrder.get(it.order_id as number) ?? '';
        itemsByOrder.set(
          it.order_id as number,
          prev ? `${prev}; ${it.product_name} ×${it.quantity}` : `${it.product_name} ×${it.quantity}`,
        );
      }
    }

    // Customer codes
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const codeMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, customer_code')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        if (p.customer_code) codeMap.set(p.user_id as string, p.customer_code as string);
      }
    }

    const STATUS_LABEL: Record<string, string> = {
      order_received: 'Received', payment_verified: 'Verified',
      packaging: 'Packing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
    };

    rows = orders.map(o => {
      const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
      const addr = o.shipping_address;
      const addrStr = addr ? [addr.street, addr.city, addr.state_province, addr.postal_code, addr.country].filter(Boolean).join(', ') : '';
      return {
        'Order #':      display,
        Date:           toKstDate(o.created_at),
        'Customer Name': o.customer_name,
        'Customer ID':   codeMap.get(o.user_id) ?? '',
        Email:           o.customer_email,
        Phone:           o.customer_phone || '',
        Items:           itemsByOrder.get(o.id) ?? '',
        Total:           o.total_cents / 100,
        Currency:        o.currency,
        Address:         addrStr,
        Status:          STATUS_LABEL[o.status] ?? o.status,
      };
    });
  }

  // Build workbook
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // Auto-fit columns by max content length
  const colWidths = rows.reduce<number[]>((acc, row) => {
    Object.values(row).forEach((v, i) => {
      acc[i] = Math.max(acc[i] ?? 0, String(v ?? '').length);
    });
    return acc;
  }, []);
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w, 8), 50) }));

  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[];
  const buf = new Uint8Array(arr).buffer;

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
