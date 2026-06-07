'use client';

import { useMemo, useState } from 'react';
import { ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { markFeedbackRead } from '@/app/manzura/feedbacks/actions';

export interface FeedbackRow {
  id: number;
  rating: 'up' | 'down';
  comment: string | null;
  is_read: boolean;
  created_at: string;
  orderRef: string | null;
  customerName: string | null;
  customerEmail: string | null;
  source?: string;
  feedbackTable?: 'feedback' | 'faq_feedback';
}

type Tab = 'all' | 'good' | 'bad';
const PAGE_SIZE = 10;

export default function FeedbacksClient({ rows }: { rows: FeedbackRow[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  // Optimistic read-state overlay so the cover/badge clears instantly on click.
  const [readOverlay, setReadOverlay] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const isRead = (r: FeedbackRow) => readOverlay[r.id] ?? r.is_read;

  const counts = useMemo(
    () => ({
      all: rows.length,
      good: rows.filter(r => r.rating === 'up').length,
      bad: rows.filter(r => r.rating === 'down').length,
    }),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter(r => (tab === 'all' ? true : tab === 'good' ? r.rating === 'up' : r.rating === 'down')),
    [rows, tab],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  function openItem(r: FeedbackRow) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(r.id)) n.delete(r.id);
      else n.add(r.id);
      return n;
    });
    if (!isRead(r)) {
      setReadOverlay(prev => ({ ...prev, [r.id]: true }));
      void markFeedbackRead(r.id, r.feedbackTable ?? 'feedback');
    }
  }

  const TABS: Array<{ value: Tab; label: string }> = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'good', label: `👍 Good (${counts.good})` },
    { value: 'bad', label: `👎 Bad (${counts.bad})` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">Feedback</h1>

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
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No feedback here yet.</p>
      ) : (
        <ul className="space-y-3">
          {paged.map(r => {
            const read = isRead(r);
            const isOpen = expanded.has(r.id);
            const longComment = (r.comment?.length ?? 0) > 140;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openItem(r)}
                  className={`w-full text-left border rounded-md p-4 transition-colors ${
                    read ? 'bg-white border-bone' : 'bg-cream border-gold/40'
                  } hover:border-gold`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.rating === 'up' ? (
                        <ThumbsUp size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <ThumbsDown size={16} className="text-rose-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate flex items-center gap-2">
                          {r.source ? (
                            <>
                              <span className="text-[9px] uppercase tracking-widest bg-gold text-white px-2 py-0.5 rounded-full shrink-0">FAQ</span>
                              <span>{r.source}</span>
                            </>
                          ) : (
                            <>
                              {r.customerName ?? 'Customer'}
                              {r.orderRef && <span className="text-mist font-normal"> · {r.orderRef}</span>}
                            </>
                          )}
                        </p>
                        {r.customerEmail && <p className="text-[11px] text-mist truncate">{r.customerEmail}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!read && (
                        <span className="text-[9px] uppercase tracking-widest bg-rose-600 text-cream px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      <span className="text-[11px] text-mist whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Comment: hidden behind a cover until the admin opens (= reads) it. */}
                  {r.comment ? (
                    !read ? (
                      <p className="text-xs text-mist italic mt-2">Click to read comment</p>
                    ) : (
                      <p className={`text-sm text-charcoal mt-2 whitespace-pre-wrap ${!isOpen && longComment ? 'line-clamp-2' : ''}`}>
                        {r.comment}
                        {longComment && (
                          <span className="text-mist text-xs"> {isOpen ? '' : '… click for more'}</span>
                        )}
                      </p>
                    )
                  ) : (
                    read && <p className="text-xs text-mist italic mt-2">No comment</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination (per subtab) */}
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
