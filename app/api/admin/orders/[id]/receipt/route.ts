import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import ExcelJS from 'exceljs';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { findCountry } from '@/lib/countries';

const GOLD   = 'FFC9A24B';
const DARK   = 'FF1F2430';
const CREAM  = 'FFF4F1EA';
const BONE   = 'FFD9D4C8';
const WHITE  = 'FFFFFFFF';

function thin(argb: string): ExcelJS.Border {
  return { style: 'thin', color: { argb } };
}

function hdr(ws: ExcelJS.Worksheet, row: number, col: number, val: ExcelJS.CellValue) {
  const cell = ws.getCell(row, col);
  cell.value = val;
  cell.font = { bold: true, color: { argb: WHITE }, name: 'Arial', size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  cell.border = { bottom: thin(GOLD) };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function dat(ws: ExcelJS.Worksheet, row: number, col: number, val: ExcelJS.CellValue, isEven: boolean) {
  const cell = ws.getCell(row, col);
  cell.value = val;
  cell.font = { name: 'Arial', size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? CREAM : WHITE } };
  cell.border = { bottom: thin(BONE), right: thin(BONE) };
  cell.alignment = { vertical: 'middle' };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const supabase = createServiceClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', orderId).single(),
    supabase.from('order_items').select('id, product_name, unit_cents, quantity, line_cents').eq('order_id', orderId).order('id'),
  ]);
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const display = order.order_seq != null ? formatOrderNumber(order.order_seq as number) : (order.order_number as string);
  const countryName = findCountry((order.shipping_address as { country: string }).country)?.name ?? (order.shipping_address as { country: string }).country;
  const addr = order.shipping_address as { street: string; city: string; state_province?: string; postal_code: string };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lumée Maison';
  wb.created = new Date();

  const ws = wb.addWorksheet('Receipt');

  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
  ws.columns = [
    { key: 'a', width: 35 },
    { key: 'b', width: 10 },
    { key: 'c', width: 14 },
    { key: 'd', width: 14 },
  ];

  // Title banner
  const titleRow = ws.addRow(['RECEIPT — ' + display, '', '', '']);
  ws.mergeCells(`A1:D1`);
  const tc = ws.getCell('A1');
  tc.value = `RECEIPT — ${display}`;
  tc.font = { bold: true, size: 13, name: 'Arial', color: { argb: WHITE } };
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  tc.alignment = { horizontal: 'center', vertical: 'middle' };
  tc.border = { bottom: thin(GOLD) };
  titleRow.height = 28;

  ws.addRow([]); // spacer

  // Metadata rows
  const metaData = [
    ['Order Number', display],
    ['Date', new Date(order.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Customer', order.customer_name as string],
    ['Email', order.customer_email as string],
    ['Phone', order.customer_phone as string],
    ...(order.fedex_account ? [['FedEx Account', order.fedex_account as string]] : []),
    ['Ship To', [addr.street, [addr.city, addr.state_province, addr.postal_code].filter(Boolean).join(', '), countryName].join(', ')],
  ];
  for (const [label, val] of metaData) {
    const r = ws.addRow([label, val, '', '']);
    ws.mergeCells(`B${r.number}:D${r.number}`);
    const labelCell = ws.getCell(`A${r.number}`);
    labelCell.font = { bold: true, name: 'Arial', size: 9, color: { argb: 'FF555555' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
    const valCell = ws.getCell(`B${r.number}`);
    valCell.font = { name: 'Arial', size: 9 };
    r.height = 16;
  }

  ws.addRow([]); // spacer

  // Items header
  const headerRow = ws.addRow([]);
  const hdrs = ['Product', 'Qty', 'Unit Price', 'Line Total'];
  hdrs.forEach((h, ci) => hdr(ws, headerRow.number, ci + 1, h));
  headerRow.height = 20;

  // Items rows
  for (let i = 0; i < (items ?? []).length; i++) {
    const it = (items ?? [])[i] as { product_name: string; quantity: number; unit_cents: number; line_cents: number };
    const r = ws.addRow([]);
    const isEven = i % 2 === 1;
    dat(ws, r.number, 1, it.product_name, isEven);
    dat(ws, r.number, 2, it.quantity, isEven);
    const uc = ws.getCell(r.number, 3);
    dat(ws, r.number, 3, it.unit_cents / 100, isEven);
    uc.numFmt = '"$"#,##0.00';
    uc.alignment = { horizontal: 'right', vertical: 'middle' };
    const lc = ws.getCell(r.number, 4);
    dat(ws, r.number, 4, it.line_cents / 100, isEven);
    lc.numFmt = '"$"#,##0.00';
    lc.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(r.number, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    r.height = 16;
  }

  // Totals
  const addTotal = (label: string, cents: number, bold = false) => {
    const r = ws.addRow([]);
    const la = ws.getCell(r.number, 1);
    ws.mergeCells(`A${r.number}:C${r.number}`);
    la.value = label;
    la.font = { name: 'Arial', size: 9, bold, color: { argb: bold ? DARK : 'FF555555' } };
    la.alignment = { horizontal: 'right', vertical: 'middle' };
    la.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bold ? CREAM : WHITE } };
    if (bold) la.border = { top: thin(DARK), bottom: thin(DARK) };
    const va = ws.getCell(r.number, 4);
    va.value = cents / 100;
    va.numFmt = '"$"#,##0.00';
    va.font = { name: 'Arial', size: bold ? 10 : 9, bold, color: { argb: bold ? DARK : 'FF555555' } };
    va.alignment = { horizontal: 'right', vertical: 'middle' };
    va.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bold ? CREAM : WHITE } };
    if (bold) va.border = { top: thin(DARK), bottom: thin(DARK) };
    r.height = 18;
  };
  ws.addRow([]);
  addTotal('Subtotal', order.subtotal_cents as number);
  const discountCents = (order.subtotal_cents as number) + (order.shipping_cents as number) - (order.total_cents as number);
  if (discountCents > 0) addTotal('Discount', -discountCents);
  addTotal('Shipping', order.shipping_cents as number);
  addTotal('TOTAL', order.total_cents as number, true);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="receipt-${display}.xlsx"`,
    },
  });
}
