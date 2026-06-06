'use client';

import ExcelPreviewModal, { type PreviewRow } from './ExcelPreviewModal';

interface OrderPreviewRow {
  order_ref: string;
  date: string;
  name: string;
  code: string;
  items: string;
  total: number;
  status: string;
}

const COLUMNS = ['Order #', 'Date', 'Customer', 'Customer ID', 'Items', 'Total (USD)', 'Status'];

export default function OrdersExportButton({
  rows,
  downloadUrl,
  date,
}: {
  rows: OrderPreviewRow[];
  downloadUrl: string;
  date: string;
}) {
  const previewRows: PreviewRow[] = rows.map(r => ({
    'Order #': r.order_ref,
    'Date': r.date,
    'Customer': r.name,
    'Customer ID': r.code,
    'Items': r.items,
    'Total (USD)': r.total,
    'Status': r.status,
  }));

  return (
    <ExcelPreviewModal
      trigger={
        <button
          type="button"
          className="text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-4 py-2 rounded transition-colors"
        >
          ↓ Export .xlsx
        </button>
      }
      title="Orders Export Preview"
      filename={`stock-orders-${date}.xlsx`}
      downloadUrl={downloadUrl}
      columns={COLUMNS}
      rows={previewRows}
    />
  );
}
