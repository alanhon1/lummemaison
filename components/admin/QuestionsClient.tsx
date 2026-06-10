'use client';

import { useState, useMemo, useTransition } from 'react';
import { X, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import {
  markHandled,
  createFaq,
  deleteFaq,
  toggleFaq,
  deleteQuestions,
  updateQuestionText,
} from '@/app/manzura/questions/actions';

export interface UnansweredRow {
  id: number;
  question_text: string;
  category: string;
  summary: string | null;
  status: 'pending' | 'handled';
  created_at: string;
}

// Rows from chat_questions (the "All questions" view) — same shape plus the
// fallback flag (whether the bot couldn't answer).
export interface AllQuestionRow extends UnansweredRow {
  is_fallback: boolean;
}

export interface FaqRow {
  id: number;
  question: string;
  answer: string;
  category: string;
  active: boolean;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  shipping: 'bg-blue-100 text-blue-700',
  payment:  'bg-emerald-100 text-emerald-700',
  product:  'bg-purple-100 text-purple-700',
  order:    'bg-amber-100 text-amber-700',
  other:    'bg-stone-100 text-stone-600',
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

type MainTab   = 'unanswered' | 'all' | 'faqs';
type StatusTab = 'pending' | 'handled';
type QSource   = 'unanswered_questions' | 'chat_questions';

interface GroupedQuestion {
  key: string;
  ids: number[];
  representative: UnansweredRow;
  count: number;
  anyFallback: boolean;
}

export default function QuestionsClient({
  unanswered,
  allQuestions,
  faqs: initialFaqs,
}: {
  unanswered: UnansweredRow[];
  allQuestions: AllQuestionRow[];
  faqs: FaqRow[];
}) {
  const [mainTab, setMainTab]       = useState<MainTab>('unanswered');
  const [statusTab, setStatusTab]   = useState<StatusTab>('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fallbackOnly, setFallbackOnly] = useState(false);
  // Optimistic hide sets are keyed `${source}:${id}` so the same numeric id in
  // both tables (unanswered_questions / chat_questions) never collide.
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [faqList, setFaqList]       = useState<FaqRow[]>(initialFaqs);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline edit
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editText, setEditText]     = useState('');

  // FAQ modal
  const [modal, setModal]   = useState<{ group: GroupedQuestion } | null>(null);
  const [modalQ, setModalQ] = useState('');
  const [modalA, setModalA] = useState('');
  const [modalCat, setModalCat] = useState('other');

  const [expandedFaq, setExpandedFaq] = useState<Set<number>>(new Set());
  const [isPending, startTransition]  = useTransition();

  // ── Active source ───────────────────────────────────────────
  const activeSource: QSource = mainTab === 'all' ? 'chat_questions' : 'unanswered_questions';
  const sourceRows: UnansweredRow[] = mainTab === 'all' ? allQuestions : unanswered;
  const skey = (id: number) => `${activeSource}:${id}`;

  function switchTab(tab: MainTab) {
    setMainTab(tab);
    setSelected(new Set());
    setEditingId(null);
    setCategoryFilter('all');
  }

  // ── Derived data ────────────────────────────────────────────
  const rows = useMemo(
    () => sourceRows.filter(r =>
      !handledIds.has(`${activeSource}:${r.id}`) &&
      !deletedIds.has(`${activeSource}:${r.id}`) &&
      (mainTab !== 'all' || !fallbackOnly || (r as AllQuestionRow).is_fallback),
    ),
    [sourceRows, handledIds, deletedIds, activeSource, mainTab, fallbackOnly],
  );

  const filtered = useMemo(() => {
    const byStatus = rows.filter(r => r.status === statusTab);
    return categoryFilter === 'all' ? byStatus : byStatus.filter(r => r.category === categoryFilter);
  }, [rows, statusTab, categoryFilter]);

  const grouped = useMemo<GroupedQuestion[]>(() => {
    const map = new Map<string, UnansweredRow[]>();
    filtered.forEach(r => {
      const key = normalize(r.question_text);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      ids: items.map(i => i.id),
      representative: items[0],
      count: items.length,
      anyFallback: items.some(i => (i as AllQuestionRow).is_fallback),
    }));
  }, [filtered]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(sourceRows.map(r => r.category)))],
    [sourceRows],
  );

  const pendingCount = unanswered.filter(
    r => r.status === 'pending'
      && !handledIds.has(`unanswered_questions:${r.id}`)
      && !deletedIds.has(`unanswered_questions:${r.id}`),
  ).length;

  const allCount = allQuestions.filter(r => !deletedIds.has(`chat_questions:${r.id}`)).length;

  // All IDs currently visible in grouped rows
  const allSelected   = grouped.length > 0 && grouped.every(g => selected.has(g.key));

  // Selected IDs (flat)
  const selectedIds = useMemo(
    () => grouped.filter(g => selected.has(g.key)).flatMap(g => g.ids),
    [grouped, selected],
  );

  // ── Selection helpers ────────────────────────────────────────
  function toggleGroup(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(grouped.map(g => g.key)));
    }
  }

  // ── Actions ─────────────────────────────────────────────────
  function handleMarkHandled(ids: number[]) {
    startTransition(async () => {
      await markHandled(ids, activeSource);
      setHandledIds(prev => new Set([...prev, ...ids.map(skey)]));
      setSelected(new Set());
    });
  }

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} question(s)?`)) return;
    startTransition(async () => {
      await deleteQuestions(selectedIds, activeSource);
      setDeletedIds(prev => new Set([...prev, ...selectedIds.map(skey)]));
      setSelected(new Set());
    });
  }

  function openCreateModal(group: GroupedQuestion) {
    setModal({ group });
    setModalQ(group.representative.summary ?? group.representative.question_text);
    setModalA('');
    setModalCat(group.representative.category);
  }

  function handleBulkFaq() {
    if (selected.size === 0) return;
    const firstGroup = grouped.find(g => selected.has(g.key));
    if (!firstGroup) return;
    // Merge all selected IDs into one FAQ modal
    const mergedGroup: GroupedQuestion = {
      key: firstGroup.key,
      ids: selectedIds,
      representative: firstGroup.representative,
      count: selectedIds.length,
      anyFallback: firstGroup.anyFallback,
    };
    openCreateModal(mergedGroup);
  }

  async function handleCreateFaq() {
    if (!modal || !modalQ.trim() || !modalA.trim()) return;
    startTransition(async () => {
      const res = await createFaq(modal.group.ids, modalQ, modalA, modalCat, activeSource);
      if (res.ok) {
        setHandledIds(prev => new Set([...prev, ...modal.group.ids.map(skey)]));
        setFaqList(prev => [{
          id: Date.now(),
          question: modalQ,
          answer: modalA,
          category: modalCat,
          active: true,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setModal(null);
        setSelected(new Set());
      }
    });
  }

  // ── Inline edit ──────────────────────────────────────────────
  function startEdit(row: UnansweredRow) {
    setEditingId(row.id);
    setEditText(row.question_text);
  }

  function handleSaveEdit(id: number) {
    if (!editText.trim()) return;
    startTransition(async () => {
      await updateQuestionText(id, editText, activeSource);
      // Mutate representative text optimistically — find the row in source array
      const r = sourceRows.find(r => r.id === id);
      if (r) r.question_text = editText.trim();
      setEditingId(null);
    });
  }

  // ── FAQ tab ──────────────────────────────────────────────────
  async function handleDeleteFaq(id: number) {
    await deleteFaq(id);
    setFaqList(prev => prev.filter(f => f.id !== id));
  }
  async function handleToggleFaq(id: number, current: boolean) {
    await toggleFaq(id, !current);
    setFaqList(prev => prev.map(f => f.id === id ? { ...f, active: !current } : f));
  }

  // ── Styles ───────────────────────────────────────────────────
  const tabCls = (active: boolean) =>
    `text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
      active ? 'bg-charcoal text-cream border-charcoal' : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
    }`;
  const subTabCls = (active: boolean) =>
    `text-xs capitalize px-3 py-1.5 rounded-full border transition-colors ${
      active ? 'bg-charcoal text-cream border-charcoal' : 'text-mist border-bone hover:text-charcoal'
    }`;

  const showQuestions = mainTab === 'unanswered' || mainTab === 'all';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">AI Questions</h1>

      {/* Main tabs */}
      <div className="flex gap-2 mb-6 border-b border-bone pb-4">
        <button onClick={() => switchTab('unanswered')} className={tabCls(mainTab === 'unanswered')}>
          Unanswered
          {pendingCount > 0 && (
            <span className="ml-2 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </button>
        <button onClick={() => switchTab('all')} className={tabCls(mainTab === 'all')}>
          All questions
          {allCount > 0 && (
            <span className="ml-2 bg-charcoal/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">{allCount}</span>
          )}
        </button>
        <button onClick={() => switchTab('faqs')} className={tabCls(mainTab === 'faqs')}>
          Bot FAQs ({faqList.filter(f => f.active).length} active)
        </button>
      </div>

      {/* ── QUESTIONS / ALL QUESTIONS TAB ── */}
      {showQuestions && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(['pending', 'handled'] as StatusTab[]).map(s => (
              <button key={s} onClick={() => { setStatusTab(s); setSelected(new Set()); }} className={subTabCls(statusTab === s)}>
                {s}
              </button>
            ))}
            {mainTab === 'all' && (
              <button
                onClick={() => { setFallbackOnly(v => !v); setSelected(new Set()); }}
                className={subTabCls(fallbackOnly)}
              >
                Unanswered only
              </button>
            )}
            <div className="ml-auto flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCategoryFilter(c)}
                  className={`text-[11px] capitalize px-2.5 py-1 rounded-full border transition-colors ${
                    categoryFilter === c ? 'bg-charcoal text-cream border-charcoal' : 'text-mist border-bone hover:text-charcoal'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-charcoal/5 border border-bone rounded-lg">
              <span className="text-xs font-medium text-charcoal">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                {statusTab === 'pending' && (
                  <button
                    onClick={() => handleMarkHandled(selectedIds)}
                    disabled={isPending}
                    className="text-[11px] px-3 py-1.5 border border-bone rounded-full text-mist hover:text-charcoal hover:border-charcoal transition-colors disabled:opacity-40"
                  >
                    Mark handled
                  </button>
                )}
                <button
                  onClick={handleBulkFaq}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-gold text-white rounded-full hover:bg-gold-dark transition-colors disabled:opacity-40"
                >
                  <Plus size={11} /> Create FAQ
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-full hover:bg-rose-100 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={11} /> Delete
                </button>
                <button onClick={() => setSelected(new Set())} className="text-mist hover:text-charcoal ml-1">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {grouped.length === 0 ? (
            <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No {statusTab} questions.</p>
          ) : (
            <ul className="space-y-2">
              {/* Select-all header */}
              <li className="flex items-center gap-3 px-4 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-bone accent-gold cursor-pointer"
                />
                <span className="text-[10px] uppercase tracking-widest text-mist">
                  {allSelected ? 'Deselect all' : 'Select all'}
                </span>
                <span className="text-[10px] text-mist ml-auto">{grouped.length} items</span>
              </li>

              {grouped.map(group => {
                const isSelected = selected.has(group.key);
                const isEditing  = editingId === group.representative.id;
                return (
                  <li
                    key={group.key}
                    className={`border rounded-md p-4 bg-white transition-colors ${
                      isSelected ? 'border-gold/50 bg-gold/5' : 'border-bone hover:border-gold/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGroup(group.key)}
                        className="w-3.5 h-3.5 mt-0.5 rounded border-bone accent-gold cursor-pointer shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[group.representative.category] ?? CATEGORY_COLORS.other}`}>
                            {group.representative.category}
                          </span>
                          {group.count > 1 && (
                            <span className="text-[10px] bg-gold/20 text-gold-dark px-2 py-0.5 rounded-full font-medium">×{group.count}</span>
                          )}
                          {mainTab === 'all' && group.anyFallback && (
                            <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">unanswered</span>
                          )}
                          <span className="text-[11px] text-mist ml-auto">
                            {new Date(group.representative.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Question text / inline edit */}
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(group.representative.id); if (e.key === 'Escape') setEditingId(null); }}
                              className="flex-1 text-sm border border-gold/60 rounded px-2 py-1 outline-none focus:border-gold text-charcoal"
                              autoFocus
                            />
                            <button onClick={() => handleSaveEdit(group.representative.id)} disabled={isPending} className="text-gold hover:text-gold-dark">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-mist hover:text-charcoal">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-charcoal leading-snug flex-1">{group.representative.question_text}</p>
                            <button
                              onClick={() => startEdit(group.representative)}
                              className="text-mist hover:text-charcoal transition-colors shrink-0 mt-0.5"
                              title="Edit question text"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}

                        {group.representative.summary && !isEditing && (
                          <p className="text-[11px] text-mist mt-0.5 italic">{group.representative.summary}</p>
                        )}
                      </div>

                      {/* Per-row actions (pending only) */}
                      {statusTab === 'pending' && !isEditing && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => openCreateModal(group)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-gold text-white rounded-full hover:bg-gold-dark transition-colors disabled:opacity-40"
                          >
                            <Plus size={11} /> FAQ
                          </button>
                          <button
                            onClick={() => handleMarkHandled(group.ids)}
                            disabled={isPending}
                            className="text-[11px] px-3 py-1.5 border border-bone text-mist rounded-full hover:border-charcoal hover:text-charcoal transition-colors disabled:opacity-40"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {/* Per-row delete (handled) */}
                      {statusTab === 'handled' && !isEditing && (
                        <button
                          onClick={() => {
                            if (!window.confirm('Delete this question?')) return;
                            startTransition(async () => {
                              await deleteQuestions(group.ids, activeSource);
                              setDeletedIds(prev => new Set([...prev, ...group.ids.map(skey)]));
                            });
                          }}
                          disabled={isPending}
                          className="text-mist hover:text-rose-500 transition-colors shrink-0 disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ── FAQs TAB ── */}
      {mainTab === 'faqs' && (
        <>
          {faqList.length === 0 ? (
            <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">No bot FAQs yet. Create them from the Questions tab.</p>
          ) : (
            <ul className="space-y-2">
              {faqList.map(f => {
                const isOpen = expandedFaq.has(f.id);
                return (
                  <li key={f.id} className={`border rounded-md bg-white transition-colors ${f.active ? 'border-bone' : 'border-bone opacity-50'}`}>
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[f.category] ?? CATEGORY_COLORS.other}`}>
                            {f.category}
                          </span>
                          {!f.active && <span className="text-[10px] text-mist italic">inactive</span>}
                        </div>
                        <p className="text-sm font-medium text-charcoal">{f.question}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => handleToggleFaq(f.id, f.active)} className="text-mist hover:text-charcoal transition-colors" title={f.active ? 'Deactivate' : 'Activate'}>
                          {f.active ? <ToggleRight size={18} className="text-gold" /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => setExpandedFaq(prev => { const n = new Set(prev); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}
                          className="text-mist hover:text-charcoal transition-colors"
                        >
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button onClick={() => handleDeleteFaq(f.id)} className="text-mist hover:text-rose-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-bone pt-3">
                        <p className="text-xs text-charcoal whitespace-pre-wrap leading-relaxed">{f.answer}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ── CREATE FAQ MODAL ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-bone">
              <h2 className="text-base font-semibold text-charcoal">Create Bot FAQ</h2>
              <button onClick={() => setModal(null)} className="text-mist hover:text-charcoal"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">Question</label>
                <input
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  className="w-full text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal"
                  placeholder="Question the bot will recognize"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">Answer</label>
                <textarea
                  value={modalA}
                  onChange={e => setModalA(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal resize-none"
                  placeholder="Write the correct answer for the bot to use"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">Category</label>
                <select
                  value={modalCat}
                  onChange={e => setModalCat(e.target.value)}
                  className="text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal bg-white"
                >
                  {['shipping', 'payment', 'product', 'order', 'other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {modal.group.count > 1 && (
                <p className="text-[11px] text-mist">
                  This will also mark {modal.group.count - 1} duplicate question{modal.group.count > 2 ? 's' : ''} as handled.
                </p>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-bone justify-end">
              <button onClick={() => setModal(null)} className="text-sm px-4 py-2 border border-bone rounded-full text-mist hover:text-charcoal transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateFaq}
                disabled={isPending || !modalQ.trim() || !modalA.trim()}
                className="text-sm px-5 py-2 bg-gold text-white rounded-full hover:bg-gold-dark disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
