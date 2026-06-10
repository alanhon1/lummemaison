'use client';

import ExcelPreviewModal, { type PreviewRow } from './ExcelPreviewModal';

interface StockRow {
  id: number;
  name: unknown;
  stock: number;
}

export default function StockExportButton({ rows, date }: { rows: StockRow[]; date: string }) {
  const columns = ['Product ID', 'Product Name', 'Current Stock', 'Status'];
  const previewRows: PreviewRow[] = rows.map(r => ({
    'Product ID': r.id,
    'Product Name': r.name as string,
    'Current Stock': r.stock,
    'Status': r.stock <= 0 ? 'Sold out' : r.stock <= 10 ? 'Low' : 'OK',
  }));

  return (
    <ExcelPreviewModal
      trigger={
        <button
          type="button"
          className="text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-4 py-2 rounded transition-colors"
        >
          ↓ Export All (5 tabs)
        </button>
      }
      title="Stock & Info — Export All (5-tab workbook)"
      filename={`lumee-stock-report-${date}.xlsx`}
      downloadUrl="/api/admin/stock/export?type=all"
      columns={columns}
      rows={previewRows}
    />
  );
}
