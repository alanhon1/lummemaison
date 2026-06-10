import 'server-only';

import type ExcelJS from 'exceljs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/lib/products';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import {
  applyHeaderStyle,
  applyDataStyle,
  applyStatusStyle,
  freezeAndFilter,
  COLORS,
  thinBorder,
} from '@/lib/excel/styles';

// Item #14 — builds the professional 5-tab Stock & Info workbook:
//   ① Stock Overview (KPIs + Most Demanded + Top Customers)
//   ② Current Stock      ③ Orders      ④ Order Items      ⑤ History
// Analytics aggregate the order_items table and exclude cancelled orders.
// All dates KST; no charts (exceljs charts are weak) — styled data + KPIs only.

const LOW_THRESHOLD = 10;

function kst(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const hdr = ws.getRow(1);
  hdr.height = 20;
  hdr.eachCell(c => applyHeaderStyle(c));
  freezeAndFilter(ws);
}

const STATUS_LABEL: Record<string, string> = {
  order_received: 'Received',
  payment_verified: 'Verified',
  packaging: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface OrderRow {
  id: number;
  order_seq: number | null;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_cents: number;
  currency: string;
  created_at: string;
  shipping_address: Record<string, string> | null;
  user_id: string;
}
interface ItemRow { order_id: number; product_id: number; product_name: string; quantity: number }
interface MoveRow {
  id: number; product_id: number; delta: number; reason: string; note: string | null; created_at: string;
  companies: { name: string } | null;
  orders: { order_seq: number | null; order_number: string } | null;
}

export async function buildFullStockReport(
  wb: ExcelJS.Workbook,
  supabase: SupabaseClient,
  allProducts: Product[],
): Promise<void> {
  const productById = new Map(allProducts.map(p => [p.id, p.name]));

  const [stockRes, ordersRes, itemsRes, movesRes] = await Promise.all([
    supabase.from('product_stock').select('product_id, stock'),
    supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, customer_email, customer_phone, total_cents, currency, created_at, shipping_address, user_id')
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase.from('order_items').select('order_id, product_id, product_name, quantity').limit(100000),
    supabase
      .from('stock_movements')
      .select('id, product_id, delta, reason, note, created_at, companies(name), orders(order_seq, order_number)')
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const items = (itemsRes.data ?? []) as unknown as ItemRow[];
  const moves = (movesRes.data ?? []) as unknown as MoveRow[];
  const stockMap = new Map(((stockRes.data ?? []) as Array<{ product_id: number; stock: number }>).map(r => [r.product_id, r.stock]));

  const orderMap = new Map(orders.map(o => [o.id, o]));
  const cancelled = new Set(orders.filter(o => o.status === 'cancelled').map(o => o.id));
  const activeOrders = orders.filter(o => o.status !== 'cancelled');

  // Customer codes + names.
  const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
  const codeMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('customer_profiles').select('user_id, customer_code').in('user_id', userIds);
    for (const p of (profiles ?? []) as Array<{ user_id: string; customer_code: string | null }>) {
      if (p.customer_code) codeMap.set(p.user_id, p.customer_code);
    }
  }
  const nameByUser = new Map<string, string>();
  for (const o of orders) if (o.user_id && !nameByUser.has(o.user_id)) nameByUser.set(o.user_id, o.customer_name);

  // Aggregations (order_items based; cancelled excluded for demand/revenue).
  const demand = new Map<number, { units: number; orders: Set<number> }>();
  const itemAgg = new Map<number, { items: number; units: number }>();
  for (const it of items) {
    const agg = itemAgg.get(it.order_id) ?? { items: 0, units: 0 };
    agg.items += 1;
    agg.units += it.quantity;
    itemAgg.set(it.order_id, agg);
    if (cancelled.has(it.order_id)) continue;
    const d = demand.get(it.product_id) ?? { units: 0, orders: new Set<number>() };
    d.units += it.quantity;
    d.orders.add(it.order_id);
    demand.set(it.product_id, d);
  }
  const mostDemanded = [...demand.entries()]
    .map(([pid, d]) => ({ pid, units: d.units, orders: d.orders.size }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 15);

  const spendByUser = new Map<string, number>();
  for (const o of activeOrders) if (o.user_id) spendByUser.set(o.user_id, (spendByUser.get(o.user_id) ?? 0) + o.total_cents);
  const topCustomers = [...spendByUser.entries()].map(([uid, cents]) => ({ uid, cents })).sort((a, b) => b.cents - a.cents).slice(0, 10);

  // KPIs.
  const stocks = allProducts.map(p => stockMap.get(p.id) ?? 0);
  const totalUnits = stocks.reduce((a, b) => a + b, 0);
  const soldOut = stocks.filter(s => s <= 0).length;
  const low = stocks.filter(s => s > 0 && s <= LOW_THRESHOLD).length;
  const healthy = stocks.filter(s => s > LOW_THRESHOLD).length;
  const revenueActive = activeOrders.reduce((a, o) => a + o.total_cents, 0) / 100;
  const aov = activeOrders.length ? revenueActive / activeOrders.length : 0;

  buildOverview();
  buildCurrentStock();
  buildOrders();
  buildOrderItems();
  buildHistory();

  // ── ① Stock Overview ──────────────────────────────────────────
  function buildOverview() {
    const ws = wb.addWorksheet('Stock Overview');
    ws.views = [{ showGridLines: false }];
    [28, 18, 12, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    ws.addRow(['LUMÉE MAISON']).font = { name: 'Arial', size: 14, bold: true, color: { argb: COLORS.DARK } };
    ws.addRow([`Stock Overview · Exported ${kst(new Date().toISOString())} (KST) · analytics exclude cancelled`]).font =
      { name: 'Arial', size: 9, color: { argb: 'FF888888' } };
    ws.addRow([]);

    ws.addRow(['KEY METRICS']).font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.GOLD } };
    const metrics: Array<[string, number]> = [
      ['Total products', allProducts.length],
      ['Total units in stock', totalUnits],
      ['Sold out (0)', soldOut],
      [`Low (<=${LOW_THRESHOLD})`, low],
      ['Healthy', healthy],
      ['Total orders', orders.length],
      ['Cancelled', cancelled.size],
      ['Active orders', activeOrders.length],
      ['Revenue - active ($)', Math.round(revenueActive * 100) / 100],
      ['Avg order value ($)', Math.round(aov * 100) / 100],
    ];
    for (const [label, value] of metrics) {
      const r = ws.addRow([label, value]);
      r.getCell(1).font = { name: 'Arial', size: 9 };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F3' } };
      r.getCell(2).font = { name: 'Arial', size: 9, bold: true };
      r.getCell(2).numFmt = label.includes('$') ? '"$"#,##0.00' : '#,##0';
    }
    ws.addRow([]);

    ws.addRow(['MOST DEMANDED PRODUCTS (top 15)']).font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.GOLD } };
    const mdHead = ws.addRow(['#', 'Product', 'Units', 'Orders']);
    mdHead.eachCell((c, col) => { if (col <= 4) applyHeaderStyle(c); });
    mostDemanded.forEach((m, i) => {
      const r = ws.addRow([i + 1, productById.get(m.pid) ?? `#${m.pid}`, m.units, m.orders]);
      [1, 2, 3, 4].forEach(col => applyDataStyle(r.getCell(col), i % 2 === 1));
      r.getCell(3).numFmt = '#,##0';
      r.getCell(4).numFmt = '#,##0';
    });
    ws.addRow([]);

    ws.addRow(['TOP CUSTOMERS (by spend, top 10)']).font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.GOLD } };
    const tcHead = ws.addRow(['Customer ID', 'Name', 'Orders', 'Spend ($)']);
    tcHead.eachCell((c, col) => { if (col <= 4) applyHeaderStyle(c); });
    topCustomers.forEach((c, i) => {
      const orderCount = activeOrders.filter(o => o.user_id === c.uid).length;
      const r = ws.addRow([codeMap.get(c.uid) ?? '-', nameByUser.get(c.uid) ?? '-', orderCount, c.cents / 100]);
      [1, 2, 3, 4].forEach(col => applyDataStyle(r.getCell(col), i % 2 === 1));
      r.getCell(4).numFmt = '"$"#,##0.00';
    });
  }

  // ── ② Current Stock ───────────────────────────────────────────
  function buildCurrentStock() {
    const ws = wb.addWorksheet('Current Stock');
    ws.columns = [
      { header: 'Product ID', key: 'id', width: 11 },
      { header: 'Product Name', key: 'name', width: 48 },
      { header: 'Current Stock', key: 'stock', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    styleHeaderRow(ws);
    allProducts.forEach((p, i) => {
      const stock = stockMap.get(p.id) ?? 0;
      const status = stock <= 0 ? 'Sold out' : stock <= LOW_THRESHOLD ? 'Low' : 'OK';
      const row = ws.addRow({ id: p.id, name: p.name, stock, status });
      row.height = 16;
      const ev = i % 2 === 1;
      applyDataStyle(row.getCell('id'), ev);
      applyDataStyle(row.getCell('name'), ev);
      applyDataStyle(row.getCell('stock'), ev);
      row.getCell('stock').numFmt = '#,##0';
      row.getCell('stock').alignment = { horizontal: 'right', vertical: 'middle' };
      applyStatusStyle(row.getCell('status'), status);
    });
    const sumRow = ws.addRow({ id: '', name: 'TOTAL UNITS', stock: { formula: `SUM(C2:C${allProducts.length + 1})` }, status: '' });
    sumRow.eachCell(c => {
      c.font = { name: 'Arial', size: 9, bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.CREAM } };
      c.border = { top: thinBorder(COLORS.DARK) };
    });
    sumRow.getCell('stock').numFmt = '#,##0';
    sumRow.getCell('stock').alignment = { horizontal: 'right', vertical: 'middle' };
  }

  // ── ③ Orders (short — items summarised) ───────────────────────
  function buildOrders() {
    const ws = wb.addWorksheet('Orders');
    ws.columns = [
      { header: 'Order #', key: 'ref', width: 13 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer Name', key: 'name', width: 18 },
      { header: 'Customer ID', key: 'code', width: 12 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Phone', key: 'phone', width: 14 },
      { header: 'Items', key: 'items', width: 16 },
      { header: 'Total (USD)', key: 'total', width: 13 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Address', key: 'address', width: 34 },
    ];
    styleHeaderRow(ws);
    orders.forEach((o, i) => {
      const display = o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
      const agg = itemAgg.get(o.id) ?? { items: 0, units: 0 };
      const addr = o.shipping_address;
      const addrStr = addr ? [addr.street, addr.city, addr.state_province, addr.postal_code, addr.country].filter(Boolean).join(', ') : '';
      const row = ws.addRow({
        ref: display,
        date: kst(o.created_at),
        name: o.customer_name,
        code: codeMap.get(o.user_id) ?? '',
        email: o.customer_email,
        phone: o.customer_phone || '',
        items: `${agg.items} items · ${agg.units} units`,
        total: o.total_cents / 100,
        status: STATUS_LABEL[o.status] ?? o.status,
        address: addrStr,
      });
      row.height = 15;
      row.eachCell(c => applyDataStyle(c, i % 2 === 1));
      row.getCell('total').numFmt = '"$"#,##0.00';
      row.getCell('total').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('address').alignment = { wrapText: true, vertical: 'middle' };
    });
  }

  // ── ④ Order Items (normalised, one product per row) ───────────
  function buildOrderItems() {
    const ws = wb.addWorksheet('Order Items');
    ws.columns = [
      { header: 'Order #', key: 'ref', width: 13 },
      { header: 'Product', key: 'product', width: 50 },
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'Order status', key: 'status', width: 14 },
    ];
    styleHeaderRow(ws);
    items.forEach((it, i) => {
      const o = orderMap.get(it.order_id);
      const display = o ? (o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number) : `#${it.order_id}`;
      const row = ws.addRow({
        ref: display,
        product: it.product_name,
        qty: it.quantity,
        status: o ? (STATUS_LABEL[o.status] ?? o.status) : '',
      });
      row.eachCell(c => applyDataStyle(c, i % 2 === 1));
      row.getCell('qty').numFmt = '#,##0';
      row.getCell('qty').alignment = { horizontal: 'right', vertical: 'middle' };
    });
  }

  // ── ⑤ History ─────────────────────────────────────────────────
  function buildHistory() {
    const REASON_LABEL: Record<string, string> = {
      inbound: 'Inbound', order: 'Order', cancel_restock: 'Cancel +stock', cancelled: 'Cancelled', adjustment: 'Adjustment',
    };
    const ws = wb.addWorksheet('History');
    ws.columns = [
      { header: 'Date (KST)', key: 'date', width: 18 },
      { header: 'Product', key: 'product', width: 46 },
      { header: 'Δ Qty', key: 'delta', width: 10 },
      { header: 'Reason', key: 'reason', width: 16 },
      { header: 'Ref / Company', key: 'ref', width: 18 },
      { header: 'Note', key: 'note', width: 24 },
    ];
    styleHeaderRow(ws);
    moves.forEach((m, i) => {
      let ref = '';
      if (m.companies?.name) ref = m.companies.name;
      if (m.orders) ref = m.orders.order_seq != null ? formatOrderNumber(m.orders.order_seq) : m.orders.order_number;
      const row = ws.addRow({
        date: kst(m.created_at),
        product: productById.get(m.product_id) ?? `#${m.product_id}`,
        delta: m.delta,
        reason: REASON_LABEL[m.reason] ?? m.reason,
        ref,
        note: m.note ?? '—',
      });
      row.eachCell(c => applyDataStyle(c, i % 2 === 1));
      const dc = row.getCell('delta');
      dc.numFmt = '+#,##0;-#,##0;0';
      dc.alignment = { horizontal: 'right', vertical: 'middle' };
      if (m.delta > 0) dc.font = { name: 'Arial', size: 9, color: { argb: COLORS.GREEN } };
      else if (m.delta < 0) dc.font = { name: 'Arial', size: 9, color: { argb: COLORS.RED } };
    });
  }
}
