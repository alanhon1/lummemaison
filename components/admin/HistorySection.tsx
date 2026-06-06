'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, X, Download } from 'lucide-react';
import ExcelPreviewModal, { type PreviewRow } from './ExcelPreviewModal';
import type { HistoryMovement } from './BatchHistoryTable';

const REASON_META: Record<string, { label: string; cls: string }> = {
  inbound:        { label: 'Inbound',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  order:          { label: 'Order',         cls: 'bg-sky-50 text-sky-700 border-sky-200'             },
  cancel_restock: { label: 'Cancel +stock', cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  adjustment:     { label: 'Adjustment',    cls: 'bg-stone-50 text-stone-600 border-stone-200'       },
};

const REASON_LABEL: Record<string, string> = {
  inbound: 'Inbound', order: 'Order', cancel_restock: 'Cancel +stock', adjustment: 'Adjustment',
};

const HISTORY_COLUMNS = ['Date (KST)', 'Product', 'Δ Qty', 'Reason', 'Ref / Company', 'Note'];

interface BatchGroup {
  batchId: number;
  date: string;
  company: string;
  totalQty: number;
  productCount: number;
  memo: string | null;
  movements: HistoryMovement[];
}

function toPreviewRow(m: HistoryMovement): PreviewRow {
  return {
    'Date (KST)': m.created_at_kst,
    'Product': m.product_name,
    'Δ Qty': m.delta,
    'Reason': REASON_LABEL[m.reason] ?? m.reason,
    'Ref / Company': m.order_ref ?? m.company_name ?? '—',
    'Note': m.note ?? '',
  };
}

export default function HistorySection({
  movements,
  exportBaseUrl,
  date,
}: {
  movements: HistoryMovement[];
  exportBaseUrl: string;
  date: string;
}) {
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [modalBatch, setModalBatch] = useState<BatchGroup | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Group inbound by batch_id, individual movements separate
  const batchMap = new Map<number, HistoryMovement[]>();
  const individualMovements: HistoryMovement[] = [];
  for (const m of movements) {
    if (m.batch_id !== null && m.reason === 'inbound') {
      const list = batchMap.get(m.batch_id) ?? [];
      list.push(m);
      batchMap.set(m.batch_id, list);
    } else {
      individualMovements.push(m);
    }
  }

  const batchGroups: BatchGroup[] = [];
  for (const [batchId, bMovements] of batchMap.entries()) {
    const first = bMovements[0];
    batchGroups.push({
      batchId,
      date: first.batch_date ?? first.created_at_kst.slice(0, 10),
      company: first.company_name ?? '—',
      totalQty: bMovements.reduce((s, m) => s + m.delta, 0),
      productCount: bMovements.length,
      memo: first.batch_memo,
      movements: bMovements,
    });
  }

  type DisplayRow =
    | { type: 'batch'; batch: BatchGroup; sortKey: string }
    | { type: 'movement'; movement: HistoryMovement; sortKey: string };

  const displayRows: DisplayRow[] = [
    ...batchGroups.map(b => ({ type: 'batch' as const, batch: b, sortKey: b.date })),
    ...individualMovements.map(m => ({ type: 'movement' as const, movement: m, sortKey: m.created_at_kst })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  function toggleBatch(id: number) {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // All selectable IDs: individual movements + movements inside batches
  const selectableIds = movements.map(m => m.id);
  function toggleAll() {
    if (selectedIds.size === selectableIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  }
  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleBatchSelection(batch: BatchGroup) {
    const batchIds = batch.movements.map(m => m.id);
    const allSelected = batchIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) batchIds.forEach(id => next.delete(id));
      else batchIds.forEach(id => next.add(id));
      return next;
    });
  }

  const selectedMovements = selectMode && selectedIds.size > 0
    ? movements.filter(m => selectedIds.has(m.id))
    : movements;

  const allPreview: PreviewRow[] = movements.map(toPreviewRow);
  const selectedPreview: PreviewRow[] = selectedMovements.map(toPreviewRow);

  const filename = `stock-history-${date}.xlsx`;

  return (
    <>
      {/* Export / Select controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ExcelPreviewModal
          trigger={
            <button type="button" className="text-xs border border-bone text-mist hover:text-charcoal hover:border-charcoal px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
              <Download size={11} /> Export All
            </button>
          }
          title="History Export Preview"
          filename={filename}
          downloadUrl={exportBaseUrl}
          columns={HISTORY_COLUMNS}
          rows={allPreview}
        />

        <button
          type="button"
          onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
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
              {selectedIds.size === selectableIds.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-mist">{selectedIds.size} of {movements.length} selected</span>
            {selectedIds.size > 0 && (
              <ExcelPreviewModal
                trigger={
                  <button type="button" className="text-xs bg-charcoal text-cream px-3 py-1.5 rounded hover:bg-charcoal/90 transition-colors flex items-center gap-1.5">
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
      </div>

      {/* Table */}
      <div className="bg-white border border-bone rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-cream border-b border-bone">
            <tr className="text-[10px] uppercase tracking-widest text-mist">
              {selectMode && <th className="px-3 py-3 w-8" />}
              <th className="text-left px-3 py-3 font-semibold">Date (KST)</th>
              <th className="text-left px-3 py-3 font-semibold">Product</th>
              <th className="text-right px-3 py-3 font-semibold">Δ Qty</th>
              <th className="text-left px-3 py-3 font-semibold">Reason</th>
              <th className="text-left px-3 py-3 font-semibold">Ref / Company</th>
              <th className="text-left px-3 py-3 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(row => {
              if (row.type === 'batch') {
                const { batch } = row;
                const isExpanded = expandedBatches.has(batch.batchId);
                return (
                  <Fragment key={`batch-${batch.batchId}`}>
                    <tr
                      className={`border-t border-bone bg-emerald-50/60 hover:bg-emerald-50 cursor-pointer ${selectMode && batch.movements.every(m => selectedIds.has(m.id)) ? 'ring-1 ring-inset ring-gold/40' : ''}`}
                      onClick={() => selectMode ? toggleBatchSelection(batch) : toggleBatch(batch.batchId)}
                    >
                      {selectMode && (
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={batch.movements.every(m => selectedIds.has(m.id))}
                            ref={el => {
                              if (el) el.indeterminate = batch.movements.some(m => selectedIds.has(m.id)) && !batch.movements.every(m => selectedIds.has(m.id));
                            }}
                            onChange={() => toggleBatchSelection(batch)}
                            className="accent-charcoal"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-xs font-mono text-mist whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {batch.date}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-emerald-800 font-semibold">
                        {batch.productCount} product{batch.productCount !== 1 ? 's' : ''} — Batch #{batch.batchId}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">+{batch.totalQty}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Inbound</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-emerald-800">{batch.company}</td>
                      <td className="px-3 py-2.5 text-xs text-mist">
                        <span className="flex items-center gap-2">
                          {batch.memo ?? '—'}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setModalBatch(batch); }}
                            className="text-[10px] underline underline-offset-2 text-gold-dark hover:text-gold whitespace-nowrap"
                          >
                            See detailed
                          </button>
                        </span>
                      </td>
                    </tr>
                    {isExpanded && batch.movements.map(m => (
                      <tr key={`bm-${m.id}`} className="border-t border-emerald-100 bg-emerald-50/30">
                        {selectMode && <td className="px-3 py-2" />}
                        <td className="px-3 py-2 pl-8 text-xs font-mono text-mist whitespace-nowrap">{m.created_at_kst}</td>
                        <td className="px-3 py-2 text-xs text-charcoal max-w-[150px] truncate">{m.product_name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">+{m.delta}</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-xs text-mist">{m.company_name ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-mist">{m.note ?? '—'}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              }

              const m = row.movement;
              const meta = REASON_META[m.reason] ?? { label: m.reason, cls: 'bg-stone-50 text-stone-600 border-stone-200' };
              const ref = m.order_ref ?? m.company_name ?? '—';
              const isSelected = selectedIds.has(m.id);
              return (
                <tr
                  key={`mov-${m.id}`}
                  className={`border-t border-bone hover:bg-cream/50 ${isSelected ? 'bg-gold-light/20' : ''}`}
                  onClick={selectMode ? () => toggleOne(m.id) : undefined}
                  style={selectMode ? { cursor: 'pointer' } : undefined}
                >
                  {selectMode && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(m.id)}
                        onClick={e => e.stopPropagation()}
                        className="accent-charcoal"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-xs font-mono text-mist whitespace-nowrap">{m.created_at_kst}</td>
                  <td className="px-3 py-2.5 text-xs text-charcoal max-w-[150px] truncate">{m.product_name}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${m.delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-mist">{ref}</td>
                  <td className="px-3 py-2.5 text-xs text-mist max-w-[120px] truncate">{m.note ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch Detail Modal */}
      {modalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setModalBatch(null)} />
          <div className="relative bg-white border border-bone rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-bone px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-light text-charcoal">
                  Batch #{modalBatch.batchId} — Inbound Detail
                </h2>
                <p className="text-xs text-mist mt-0.5">
                  {modalBatch.date} · {modalBatch.company}
                  {modalBatch.memo ? ` · ${modalBatch.memo}` : ''}
                </p>
              </div>
              <button onClick={() => setModalBatch(null)} className="text-mist hover:text-charcoal">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Products</p>
                  <p className="text-xl font-semibold text-charcoal">{modalBatch.productCount}</p>
                </div>
                <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Total Units</p>
                  <p className="text-xl font-semibold text-emerald-700">+{modalBatch.totalQty}</p>
                </div>
                <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Supplier</p>
                  <p className="text-sm font-semibold text-charcoal truncate">{modalBatch.company}</p>
                </div>
              </div>
              <table className="w-full text-sm border border-bone rounded overflow-hidden">
                <thead className="bg-cream">
                  <tr className="text-[10px] uppercase tracking-widest text-mist border-b border-bone">
                    <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Quantity</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {modalBatch.movements.map((m, i) => (
                    <tr key={m.id} className={`border-t border-bone ${i % 2 === 1 ? 'bg-cream/30' : ''}`}>
                      <td className="px-4 py-2.5 text-charcoal">{m.product_name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">+{m.delta}</td>
                      <td className="px-4 py-2.5 text-xs text-mist">{m.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-charcoal">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-charcoal">Total</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">+{modalBatch.totalQty}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
