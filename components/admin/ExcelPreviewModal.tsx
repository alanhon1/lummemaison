'use client';

import { useState } from 'react';
import { X, Download } from 'lucide-react';

export interface PreviewRow {
  [key: string]: string | number | null;
}

interface Props {
  trigger: React.ReactNode;
  title: string;
  filename: string;
  downloadUrl: string;
  columns: string[];
  rows: PreviewRow[];
  maxPreviewRows?: number;
}

const DELTA_COL_PATTERN = /^[Δ]/;
const STATUS_COLORS: Record<string, string> = {
  'Sold out': 'text-rose-600 font-semibold',
  'Low':      'text-amber-600 font-semibold',
  'OK':       'text-emerald-700',
};

export default function ExcelPreviewModal({
  trigger, title, filename, downloadUrl, columns, rows, maxPreviewRows = 50,
}: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  const preview = rows.slice(0, maxPreviewRows);
  const truncated = rows.length > maxPreviewRows;

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white border border-bone rounded-lg shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-bone shrink-0">
              <div>
                <h2 className="font-display text-lg font-light text-charcoal">{title}</h2>
                <p className="text-xs text-mist mt-0.5">{filename} · {rows.length} rows</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-mist hover:text-charcoal">
                <X size={18} />
              </button>
            </div>

            {/* Table preview */}
            <div className="overflow-auto flex-1 px-6 py-4">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="bg-[#1F2430] text-white">
                    {columns.map(col => (
                      <th
                        key={col}
                        className="text-left px-3 py-2.5 text-[9px] uppercase tracking-widest font-semibold border-b-2 border-[#C9A24B] whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-[#F4F1EA]' : 'bg-white'}>
                      {columns.map(col => {
                        const val = row[col];
                        const display = val === null || val === undefined ? '—' : String(val);
                        let extraCls = '';
                        if (DELTA_COL_PATTERN.test(col) && typeof val === 'number') {
                          extraCls = val > 0 ? 'text-emerald-700 font-semibold' : val < 0 ? 'text-rose-600 font-semibold' : '';
                        }
                        if (col === 'Status' || col === 'status') {
                          extraCls = STATUS_COLORS[display] ?? '';
                        }
                        return (
                          <td key={col} className={`px-3 py-2 border-b border-[#D9D4C8] ${extraCls}`}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {truncated && (
                <p className="text-[10px] text-mist text-center pt-3">
                  Showing first {maxPreviewRows} of {rows.length} rows — all rows will be included in the download.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-bone shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="text-xs border border-bone px-4 py-2 rounded text-mist hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 text-xs bg-charcoal text-cream px-5 py-2 rounded hover:bg-charcoal/90 transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {downloading ? 'Generating…' : 'Download Excel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
