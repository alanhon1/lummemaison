import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import ExcelJS from 'exceljs';
import { sessionOptions, type SessionData } from '@/lib/session';
import { readBackup } from '@/lib/backup';
import { categories } from '@/lib/products';
import { discountPercent } from '@/lib/fake-discount';
import { applyHeaderStyle, applyDataStyle, freezeAndFilter } from '@/lib/excel/styles';

// Downloads a backup snapshot as a styled Excel workbook, INCLUDING sale info
// (current price, original "was" price, % off, on-sale). The admin opens this
// from the backup-preview modal. Auth: admin session (and the admin proxy lets
// /api/admin/* through for a logged-in session).
export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return new Response('Unauthorized', { status: 401 });

  const name = new URL(req.url).searchParams.get('name') ?? '';
  const products = await readBackup(name);
  if (!products) return new Response('Backup not found', { status: 404 });

  const categoryName = new Map(categories.map(c => [c.id, c.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lumée Maison';
  wb.created = new Date();
  const ws = wb.addWorksheet('Catalogue');
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Name', key: 'name', width: 42 },
    { header: 'Variant', key: 'variant', width: 22 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Options', key: 'options', width: 20 },
    { header: 'Price (now)', key: 'price', width: 13 },
    { header: 'Was (original)', key: 'was', width: 14 },
    { header: '% Off', key: 'off', width: 9 },
    { header: 'On Sale', key: 'sale', width: 10 },
  ];
  const hdr = ws.getRow(1);
  hdr.height = 20;
  hdr.eachCell(c => applyHeaderStyle(c));
  freezeAndFilter(ws);

  const sorted = [...products].sort((a, b) => a.id - b.id);
  let onSaleCount = 0;
  sorted.forEach((p, i) => {
    const pct = discountPercent(p.price, p.originalPrice);
    const onSale = pct > 0;
    if (onSale) onSaleCount++;
    const row = ws.addRow({
      id: p.id,
      name: p.name,
      variant: p.variantLabel ?? '',
      category: categoryName.get(p.categoryId) ?? p.categoryId,
      options: Array.isArray(p.options) ? p.options.join(' / ') : '',
      price: p.price,
      was: onSale ? p.originalPrice : '',
      off: onSale ? pct / 100 : '',
      sale: onSale ? 'Yes' : 'No',
    });
    row.height = 15;
    const ev = i % 2 === 1;
    row.eachCell(c => applyDataStyle(c, ev));
    row.getCell('price').numFmt = '"$"#,##0.00';
    row.getCell('price').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('was').numFmt = '"$"#,##0.00';
    row.getCell('was').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('off').numFmt = '0%';
    row.getCell('off').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('sale').alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Summary row.
  const sum = ws.addRow({ name: `${sorted.length} products · ${onSaleCount} on sale`, sale: '' });
  sum.getCell('name').font = { name: 'Arial', size: 9, bold: true };

  const safe = name.replace(/[^0-9A-Za-z._-]/g, '_') || 'backup';
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safe}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
