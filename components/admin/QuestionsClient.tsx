'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import { markHandled, createFaq, deleteFaq, toggleFaq } from '@/app/manzura/questions/actions';

export interface UnansweredRow {
  id: number;
  question_text: string;
  category: string;
  summary: string | null;
  status: 'pending' | 'handled';
  created_at: string;
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
  payment: 'bg-emerald-100 text-emerald-700',
  product: 'bg-purple-100 text-purple-700',
  order: 'bg-amber-100 text-amber-700',
  other: 'bg-stone-100 text-stone-600',
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type MainTab = 'unanswered' | 'faqs';
type StatusTab = 'pending' | 'handled';

interface GroupedQuestion {
  key: string;
  ids: number[];
  representative: UnansweredRow;
  count: number;
}

export default function QuestionsClient({
  unanswered,
  faqs: initialFaqs,
}: {
  unanswered: UnansweredRow[];
  faqs: FaqRow[];
}) {
  const [mainTab, setMainTab] = useState<MainTab>('unanswered');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [handledIds, setHandledIds] = useState<Set<number>>(new Set());
  const [faqList, setFaqList] = useState<FaqRow[]>(initialFaqs);
  const [modal, setModal] = useState<{ group: GroupedQuestion } | null>(null);
  const [modalQ, setModalQ] = useState('');
  const [modalA, setModalA] = useState('');
  const [modalCat, setModalCat] = useState('other');
  const [saving, setSaving] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<Set<number>>(new Set());

  const rows = useMemo(
    () => unanswered.filter(r => !handledIds.has(r.id)),
    [unanswered, handledIds],
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
    }));
  }, [filtered]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(unanswered.map(r => r.category)))],
    [unanswered],
  );

  const pendingCount = unanswered.filter(r => r.status === 'pending' && !handledIds.has(r.id)).length;

  function openCreateModal(group: GroupedQuestion) {
    setModal({ group });
    setModalQ(group.representative.summary ?? group.representative.question_text);
    setModalA('');
    setModalCat(group.representative.category);
  }

  async function handleMarkHandled(ids: number[]) {
    await markHandled(ids);
    setHandledIds(prev => new Set([...prev, ...ids]));
  }

  async function handleCreateFaq() {
    if (!modal || !modalQ.trim() || !modalA.trim()) return;
    setSaving(true);
    const res = await createFaq(modal.group.ids, modalQ, modalA, modalCat);
    setSaving(false);
    if (res.ok) {
      setHandledIds(prev => new Set([...prev, ...modal.group.ids]));
      setFaqList(prev => [
        {
          id: Date.now(),
          question: modalQ,
          answer: modalA,
          category: modalCat,
          active: true,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setModal(null);
    }
  }

  async function handleDeleteFaq(id: number) {
    await deleteFaq(id);
    setFaqList(prev => prev.filter(f => f.id !== id));
  }

  async function handleToggleFaq(id: number, current: boolean) {
    await toggleFaq(id, !current);
    setFaqList(prev => prev.map(f => (f.id === id ? { ...f, active: !current } : f)));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">AI Questions</h1>

      {/* Main tabs */}
      <div className="flex gap-2 mb-6 border-b border-bone pb-4">
        <button
          onClick={() => setMainTab('unanswered')}
          className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
            mainTab === 'unanswered'
              ? 'bg-charcoal text-cream border-charcoal'
              : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
          }`}
        >
          Unanswered
          {pendingCount > 0 && (
            <span className="ml-2 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab('faqs')}
          className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
            mainTab === 'faqs'
              ? 'bg-charcoal text-cream border-charcoal'
              : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
          }`}
        >
          Bot FAQs ({faqList.filter(f => f.active).length} active)
        </button>
      </div>

      {/* ── UNANSWERED TAB ── */}
      {mainTab === 'unanswered' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Status subtabs */}
            {(['pending', 'handled'] as StatusTab[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusTab(s)}
                className={`text-xs capitalize px-3 py-1.5 rounded-full border transition-colors ${
                  statusTab === s
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'text-mist border-bone hover:text-charcoal'
                }`}
              >
                {s}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`text-[11px] capitalize px-2.5 py-1 rounded-full border transition-colors ${
                    categoryFilter === c
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'text-mist border-bone hover:text-charcoal'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">
              No {statusTab} questions.
            </p>
          ) : (
            <ul className="space-y-2">
              {grouped.map(group => (
                <li
                  key={group.key}
                  className="border border-bone rounded-md p-4 bg-white hover:border-gold/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${
                            CATEGORY_COLORS[group.representative.category] ?? CATEGORY_COLORS.other
                          }`}
                        >
                          {group.representative.category}
                        </span>
                        {group.count > 1 && (
                          <span className="text-[10px] bg-gold/20 text-gold-dark px-2 py-0.5 rounded-full font-medium">
                            ×{group.count}
                          </span>
                        )}
                        <span className="text-[11px] text-mist ml-auto">
                          {new Date(group.representative.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal leading-snug">
                        {group.representative.question_text}
                      </p>
                      {group.representative.summary && (
                        <p className="text-[11px] text-mist mt-0.5 italic">
                          {group.representative.summary}
                        </p>
                      )}
                    </div>
                    {statusTab === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openCreateModal(group)}
                          className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-gold text-white rounded-full hover:bg-gold-dark transition-colors"
                        >
                          <Plus size={11} /> Create FAQ
                        </button>
                        <button
                          onClick={() => handleMarkHandled(group.ids)}
                          className="text-[11px] px-3 py-1.5 border border-bone text-mist rounded-full hover:border-charcoal hover:text-charcoal transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── FAQs TAB ── */}
      {mainTab === 'faqs' && (
        <>
          {faqList.length === 0 ? (
            <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">
              No bot FAQs yet. Create them from the Unanswered tab.
            </p>
          ) : (
            <ul className="space-y-2">
              {faqList.map(f => {
                const isOpen = expandedFaq.has(f.id);
                return (
                  <li key={f.id} className={`border rounded-md bg-white transition-colors ${f.active ? 'border-bone' : 'border-bone opacity-50'}`}>
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${
                              CATEGORY_COLORS[f.category] ?? CATEGORY_COLORS.other
                            }`}
                          >
                            {f.category}
                          </span>
                          {!f.active && (
                            <span className="text-[10px] text-mist italic">inactive</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-charcoal">{f.question}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleFaq(f.id, f.active)}
                          className="text-mist hover:text-charcoal transition-colors"
                          title={f.active ? 'Deactivate' : 'Activate'}
                        >
                          {f.active ? <ToggleRight size={18} className="text-gold" /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() =>
                            setExpandedFaq(prev => {
                              const n = new Set(prev);
                              n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                              return n;
                            })
                          }
                          className="text-mist hover:text-charcoal transition-colors"
                        >
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(f.id)}
                          className="text-mist hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-bone pt-3">
                        <p className="text-xs text-charcoal whitespace-pre-wrap leading-relaxed">
                          {f.answer}
                        </p>
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
              <button onClick={() => setModal(null)} className="text-mist hover:text-charcoal">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">
                  Question
                </label>
                <input
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  className="w-full text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal"
                  placeholder="Question the bot will recognize"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">
                  Answer
                </label>
                <textarea
                  value={modalA}
                  onChange={e => setModalA(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal resize-none"
                  placeholder="Write the correct answer for the bot to use"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-mist mb-1.5 block">
                  Category
                </label>
                <select
                  value={modalCat}
                  onChange={e => setModalCat(e.target.value)}
                  className="text-sm border border-bone rounded-lg px-3 py-2 outline-none focus:border-gold text-charcoal bg-white"
                >
                  {['shipping', 'payment', 'product', 'order', 'other'].map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
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
              <button
                onClick={() => setModal(null)}
                className="text-sm px-4 py-2 border border-bone rounded-full text-mist hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFaq}
                disabled={saving || !modalQ.trim() || !modalA.trim()}
                className="text-sm px-5 py-2 bg-gold text-white rounded-full hover:bg-gold-dark disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
