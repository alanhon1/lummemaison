'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import ExcelPreviewModal, { type PreviewRow } from './ExcelPreviewModal';
import type { HistoryMovement } from './BatchHistoryTable';

const REASON_LABEL: Record<string, string> = {
  inbound: 'Inbound', order: 'Order', cancel_restock: 'Cancel +stock', adjustment: 'Adjustment',
};

const HISTORY_COLUMNS = ['Date (KST)', 'Product', 'Δ Qty', 'Reason', 'Ref / Company', 'Note'];

function toPreviewRows(movements: HistoryMovement[]): PreviewRow[] {
  return movements.map(m => ({
    'Date (KST)': m.created_at_kst,
    'Product': m.product_name,
    'Δ Qty': m.delta,
    'Reason': REASON_LABEL[m.reason] ?? m.reason,
    'Ref / Company': m.order_ref ?? m.company_name ?? '—',
    'Note': m.note ?? '',
  }));
}

export default function HistoryExportPanel({
  movements,
  exportBaseUrl,
  date,
}: {
  movements: HistoryMovement[];
  exportBaseUrl: string;
  date: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  function toggleAll() {
    if (selectedIds.size === movements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(movements.map(m => m.id)));
    }
  }

  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedMovements = selectMode && selectedIds.size > 0
    ? movements.filter(m => selectedIds.has(m.id))
    : movements;

  const allPreview = toPreviewRows(movements);
  const selectedPreview = toPreviewRows(selectedMovements);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Export All */}
      <ExcelPreviewModal
        trigger={
          <button type="button" className="text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-4 py-2 rounded transition-colors flex items-center gap-1.5">
            <Download size={11} /> Export All
          </button>
        }
        title="History Export Preview"
        filename={`stock-history-${date}.xlsx`}
        downloadUrl={exportBaseUrl}
        columns={HISTORY_COLUMNS}
        rows={allPreview}
      />

      {/* Select mode toggle + Export Selected */}
      <button
        type="button"
        onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
        className={`text-xs px-3 py-2 rounded border transition-colors ${
          selectMode
            ? 'bg-charcoal text-cream border-charcoal'
            : 'border-bone text-mist hover:text-charcoal hover:border-charcoal'
        }`}
      >
        {selectMode ? 'Cancel Select' : 'Select Rows'}
      </button>

      {selectMode && (
        <>
          <button type="button" onClick={toggleAll} className="text-xs text-mist hover:text-charcoal underline underline-offset-2">
            {selectedIds.size === movements.length ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs text-mist">{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <ExcelPreviewModal
              trigger={
                <button type="button" className="text-xs bg-gold-dark text-white px-3 py-2 rounded hover:bg-gold transition-colors flex items-center gap-1.5">
                  <Download size={11} /> Export Selected ({selectedIds.size})
                </button>
              }
              title={`Selected History (${selectedIds.size} rows)`}
              filename={`stock-history-selected-${date}.xlsx`}
              downloadUrl={exportBaseUrl}
              columns={HISTORY_COLUMNS}
              rows={selectedPreview}
            />
          )}
        </>
      )}

      {/* Checkbox column state exposed via context pattern — use data attribute on table */}
      {selectMode && (
        <div className="w-full mt-2 hidden" data-select-mode="true" data-selected-ids={JSON.stringify([...selectedIds])} />
      )}
    </div>
  );
}

// Sub-component: a checkbox cell for history rows (used inside BatchHistoryTable when select mode is active)
// Export for use in BatchHistoryTable — but we'll manage selection via HistoryExportPanel's state lifted up
export { toPreviewRows };
