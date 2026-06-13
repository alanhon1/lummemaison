'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Mail, Trash2 } from 'lucide-react';
import { markIssueRead, deleteIssue } from '@/app/manzura/issues/actions';

export interface IssueRow {
  id: number;
  message: string;
  contact_email: string | null;
  is_read: boolean;
  created_at: string;
}

type Tab = 'all' | 'unread';
const PAGE_SIZE = 10;

export default function IssuesClient({ rows }: { rows: IssueRow[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  // Optimistic overlays so the UI updates instantly on click.
  const [readOverlay, setReadOverlay] = useState<Record<number, boolean>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const isRead = (r: IssueRow) => readOverlay[r.id] ?? r.is_read;

  const visible = useMemo(() => rows.filter(r => !removed.has(r.id)), [rows, removed]);

  const counts = useMemo(
    () => ({
      all: visible.length,
      unread: visible.filter(r => !isRead(r)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, readOverlay],
  );

  const filtered = useMemo(
    () => visible.filter(r => (tab === 'all' ? true : !isRead(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, tab, readOverlay],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  function openItem(r: IssueRow) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(r.id)) n.delete(r.id);
      else n.add(r.id);
      return n;
    });
    if (!isRead(r)) {
      setReadOverlay(prev => ({ ...prev, [r.id]: true }));
      void markIssueRead(r.id);
    }
  }

  function remove(id: number) {
    setRemoved(prev => new Set(prev).add(id));
    void deleteIssue(id);
  }

  const TABS: Array<{ value: Tab; label: string }> = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'unread', label: `Unread (${counts.unread})` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">Reported issues</h1>

      {/* Subtabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => changeTab(t.value)}
            className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
              tab === t.value
                ? 'bg-charcoal text-cream border-charcoal'
                : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No reported issues here.</p>
      ) : (
        <ul className="space-y-3">
          {paged.map(r => {
            const read = isRead(r);
            const isOpen = expanded.has(r.id);
            const longMessage = r.message.length > 140;
            return (
              <li key={r.id}>
                <div
                  className={`border rounded-md p-4 transition-colors ${
                    read ? 'bg-white border-bone' : 'bg-cream border-gold/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openItem(r)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-medium text-charcoal flex items-center gap-2">
                        {!read && (
                          <span className="text-[9px] uppercase tracking-widest bg-rose-600 text-cream px-2 py-0.5 rounded-full shrink-0">
                            New
                          </span>
                        )}
                        <span className="text-[11px] text-mist font-normal">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </p>
                      {r.contact_email && (
                        <p className="text-[11px] text-mist truncate mt-1 flex items-center gap-1">
                          <Mail size={11} className="shrink-0" />
                          {r.contact_email}
                        </p>
                      )}
                      <p className={`text-sm text-charcoal mt-2 whitespace-pre-wrap ${!isOpen && longMessage ? 'line-clamp-2' : ''}`}>
                        {r.message}
                        {longMessage && !isOpen && <span className="text-mist text-xs"> … click for more</span>}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.contact_email && (
                        <a
                          href={`mailto:${r.contact_email}`}
                          className="text-mist hover:text-gold-dark transition-colors"
                          aria-label="Reply by email"
                          title="Reply by email"
                        >
                          <Mail size={15} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-mist hover:text-red-600 transition-colors"
                        aria-label="Delete issue"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-8 h-8 inline-flex items-center justify-center border rounded-md text-xs transition-colors ${
                n === safePage ? 'border-gold bg-gold text-white' : 'border-bone text-charcoal hover:border-gold hover:text-gold-dark'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-8 h-8 inline-flex items-center justify-center border border-bone rounded-md text-mist disabled:opacity-30 hover:border-gold hover:text-gold-dark transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
