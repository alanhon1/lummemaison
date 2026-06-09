import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import ExcelJS from 'exceljs';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { applyHeaderStyle, applyDataStyle, applyStatusStyle, freezeAndFilter, COLORS, thinBorder } from '@/lib/excel/styles';

function toKstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}
function kstDateToUtcStart(d: string): string { return new Date(`${d}T00:00:00+09:00`).toISOString(); }
function kstDateToUtcEnd(d: string):   string { return new Date(`${d}T23:59:59+09:00`).toISOString(); }

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'stock';

  const supabase = createServiceClient();
  const allProducts = await getAllProducts();
  const productById = new Map(allProducts.map(p => [p.id, p.name as string]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lumée Maison';
  wb.created = new Date();

  // ── STOCK ─────────────────────────────────────────────────────
  if (type === 'stock') {
    const { data: stockRows } = await supabase
      .from('product_stock').select('product_id, stock').order('product_id');
    const stockMap = new Map((stockRows ?? []).map(r => [r.product_id as number, r.stock as number]));

    const ws = wb.addWorksheet('Stock');
    ws.columns = [
      { header: 'Product ID',    key: 'id',     width: 12 },
      { header: 'Product Name',  key: 'name',   width: 42 },
      { header: 'Current Stock', key: 'stock',  width: 14 },
      { header: 'Status',        key: 'status', width: 12 },
    ];
    // Style header
    const hdr = ws.getRow(1);
    hdr.height = 20;
    hdr.eachCell(cell => applyHeaderStyle(cell));
    freezeAndFilter(ws);

    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      const stock = stockMap.get(p.id) ?? 0;
      const status = stock <= 0 ? 'Sold out' : stock <= 10 ? 'Low' : 'OK';
      const row = ws.addRow({ id: p.id, name: p.name, stock, status });
      row.height = 16;
      const isEven = i % 2 === 1;
      applyDataStyle(row.getCell('id'), isEven);
      applyDataStyle(row.getCell('name'), isEven);
      applyDataStyle(row.getCell('stock'), isEven);
      row.getCell('stock').numFmt = '#,##0';
      row.getCell('stock').alignment = { horizontal: 'right', vertical: 'middle' };
      applyStatusStyle(row.getCell('status'), status);
    }

    // Sum row
    const sumRow = ws.addRow({ id: '', name: 'TOTAL', stock: { formula: `SUM(C2:C${allProducts.length + 1})` }, status: '' });
    sumRow.height = 18;
    sumRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 9, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.CREAM } };
      cell.border = { top: thinBorder(COLORS.DARK) };
    });
    sumRow.getCell('stock').numFmt = '#,##0';
    sumRow.getCell('stock').alignment = { horizontal: 'right', vertical: 'middle' };

    const filename = `stock-current-${toKstDate(new Date().toISOString())}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── HISTORY ───────────────────────────────────────────────────
  if (type === 'history') {
    const pid    = searchParams.get('pid')    ?? '';
    const from   = searchParams.get('from')   ?? '';
    const to     = searchParams.get('to')     ?? '';
    const reason = searchParams.get('reason') ?? '';
    const cid    = searchParams.get('cid')    ?? '';
    const date   = searchParams.get('date')   ?? '';

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
      inbound: 'Inbound', order: 'Order', cancel_restock: 'Cancel +stock',
      cancelled: 'Cancelled', adjustment: 'Adjustment',
    };

    const ws = wb.addWorksheet('History');
    ws.columns = [
      { header: 'Date (KST)', key: 'date',    width: 13 },
      { header: 'Product ID', key: 'pid',     width: 12 },
      { header: 'Product',    key: 'product', width: 38 },
      { header: 'Δ Qty',      key: 'delta',   width: 10 },
      { header: 'Reason',     key: 'reason',  width: 16 },
      { header: 'Reference',  key: 'ref',     width: 18 },
      { header: 'Note',       key: 'note',    width: 26 },
    ];
    const hdr = ws.getRow(1);
    hdr.height = 20;
    hdr.eachCell(cell => applyHeaderStyle(cell));
    freezeAndFilter(ws);

    for (let i = 0; i < typedMovements.length; i++) {
      const m = typedMovements[i];
      let ref = '';
      if (m.companies?.name) ref = m.companies.name;
      if (m.orders) {
        const seq = m.orders.order_seq;
        ref = seq != null ? formatOrderNumber(seq) : m.orders.order_number;
      }
      const row = ws.addRow({
        date: toKstDate(m.created_at),
        pid: m.product_id,
        product: productById.get(m.product_id) ?? `#${m.product_id}`,
        delta: m.delta,
        reason: REASON_LABEL[m.reason] ?? m.reason,
        ref,
        note: m.note ?? '',
      });
      row.height = 15;
      const isEven = i % 2 === 1;
      row.eachCell(cell => applyDataStyle(cell, isEven));
      // Colour delta cell
      const deltaCell = row.getCell('delta');
      deltaCell.numFmt = '+#,##0;-#,##0;0';
      deltaCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (m.delta > 0) deltaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.GREEN } };
      else if (m.delta < 0) deltaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.RED } };
    }

    const filename = `stock-history-${toKstDate(new Date().toISOString())}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── ORDERS ────────────────────────────────────────────────────
  if (type === 'orders') {
    const from   = searchParams.get('from')   ?? '';
    const to     = searchParams.get('to')     ?? '';
    const status = searchParams.get('reason') ?? '';

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

    const orderIds = orders.map(o => o.id);
    const itemsByOrder = new Map<number, string>();
    if (orderIds.length > 0) {
      const { data: items } = await supabase.from('order_items').select('order_id, product_name, quantity').in('order_id', orderIds);
      for (const it of items ?? []) {
        const prev = itemsByOrder.get(it.order_id as number) ?? '';
        itemsByOrder.set(it.order_id as number, prev ? `${prev}; ${it.product_name} ×${it.quantity}` : `${it.product_name} ×${it.quantity}`);
      }
    }

    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const codeMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('customer_profiles').select('user_id, customer_code').in('user_id', userIds);
      for (const p of profiles ?? []) {
        if (p.customer_code) codeMap.set(p.user_id as string, p.customer_code as string);
      }
    }

    const STATUS_LABEL: Record<string, string> = {
      order_received: 'Received', payment_verified: 'Verified',
      packaging: 'Packing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
    };

    const ws = wb.addWorksheet('Orders');
    ws.columns = [
      { header: 'Order #',       key: 'order_ref',  width: 14 },
      { header: 'Date',          key: 'date',       width: 13 },
      { header: 'Customer Name', key: 'name',       width: 22 },
      { header: 'Customer ID',   key: 'code',       width: 14 },
      { header: 'Email',         key: 'email',      width: 28 },
      { header: 'Phone',         key: 'phone',      width: 16 },
      { header: 'Items',         key: 'items',      width: 40 },
      { header: 'Total (USD)',   key: 'total',      width: 13 },
      { header: 'Address',       key: 'address',    width: 36 },
      { header: 'Status',        key: 'status',     width: 14 },
    ];
    const hdr = ws.getRow(1);
    hdr.height = 20;
    hdr.eachCell(cell => applyHeaderStyle(cell));
    freezeAndFilter(ws);

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
      const addr = o.shipping_address;
      const addrStr = addr ? [addr.street, addr.city, addr.state_province, addr.postal_code, addr.country].filter(Boolean).join(', ') : '';
      const statusLabel = STATUS_LABEL[o.status] ?? o.status;
      const row = ws.addRow({
        order_ref: display,
        date: toKstDate(o.created_at),
        name: o.customer_name,
        code: codeMap.get(o.user_id) ?? '',
        email: o.customer_email,
        phone: o.customer_phone || '',
        items: itemsByOrder.get(o.id) ?? '',
        total: o.total_cents / 100,
        address: addrStr,
        status: statusLabel,
      });
      row.height = 15;
      const isEven = i % 2 === 1;
      row.eachCell(cell => applyDataStyle(cell, isEven));
      const totalCell = row.getCell('total');
      totalCell.numFmt = '"$"#,##0.00';
      totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
    }

    const filename = `stock-orders-${toKstDate(new Date().toISOString())}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response('Unknown type', { status: 400 });
}
