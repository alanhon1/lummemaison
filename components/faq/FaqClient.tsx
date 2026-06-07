'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { FaqItem } from '@/lib/faq-data';

type Locale = 'en' | 'ru';
type Rating = 'up' | 'down';

const LABELS = {
  helpful: { en: 'Was this helpful?', ru: 'Это было полезно?' },
  thanks: { en: 'Thank you for your feedback!', ru: 'Спасибо за ваш отзыв!' },
  placeholder: { en: 'Tell us more (optional)…', ru: 'Расскажите подробнее (необязательно)…' },
  submit: { en: 'Submit', ru: 'Отправить' },
};

export default function FaqClient({ items, locale }: { items: FaqItem[]; locale: Locale }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setOpenId(prev => (prev === id ? null : id));
  }

  async function submitFeedback(faqNumber: number, rating: Rating, comment?: string) {
    await fetch('/api/faq-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faqNumber, rating, comment }),
    });
  }

  async function handleRating(item: FaqItem, rating: Rating) {
    if (ratings[item.id]) return;
    setRatings(prev => ({ ...prev, [item.id]: rating }));
    await submitFeedback(item.id, rating);
  }

  async function handleCommentSubmit(item: FaqItem) {
    if (sending.has(item.id) || submitted.has(item.id)) return;
    setSending(prev => new Set(prev).add(item.id));
    const rating = ratings[item.id];
    const comment = comments[item.id]?.trim();
    if (rating && comment) {
      await submitFeedback(item.id, rating, comment);
    }
    setSending(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    setSubmitted(prev => new Set(prev).add(item.id));
  }

  const l = locale as Locale;

  return (
    <div className="space-y-3">
      {items.map(item => {
        const isOpen = openId === item.id;
        const rated = !!ratings[item.id];
        const done = submitted.has(item.id);
        const num = String(item.id).padStart(2, '0');

        return (
          <div key={item.id} className="border border-bone rounded-xl overflow-hidden bg-surface">
            {/* Question row */}
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-cream transition-colors group"
            >
              <span className="text-xs font-mono text-gold shrink-0 select-none">#{num}</span>
              <span className="flex-1 text-sm font-medium text-charcoal leading-snug">
                {item.q[l]}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 text-mist group-hover:text-gold transition-colors"
              >
                <ChevronDown size={18} />
              </motion.span>
            </button>

            {/* Answer + feedback */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pt-1 pb-5 border-t border-bone bg-cream">
                    {/* Answer text — render ** as bold */}
                    <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap mb-5">
                      {item.a[l].split(/\*\*(.+?)\*\*/g).map((part, i) =>
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                      )}
                    </p>

                    {/* Feedback row */}
                    <div className="border-t border-bone pt-4">
                      {done ? (
                        <p className="text-xs text-mist italic">{LABELS.thanks[l]}</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-mist">{LABELS.helpful[l]}</span>
                            <button
                              type="button"
                              onClick={() => handleRating(item, 'up')}
                              disabled={rated}
                              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                                ratings[item.id] === 'up'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                                  : 'border-bone text-mist hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40'
                              }`}
                              aria-label="Helpful"
                            >
                              <ThumbsUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRating(item, 'down')}
                              disabled={rated}
                              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                                ratings[item.id] === 'down'
                                  ? 'bg-rose-50 border-rose-300 text-rose-500'
                                  : 'border-bone text-mist hover:border-rose-300 hover:text-rose-500 disabled:opacity-40'
                              }`}
                              aria-label="Not helpful"
                            >
                              <ThumbsDown size={13} />
                            </button>
                          </div>

                          <AnimatePresence>
                            {rated && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="flex items-center gap-2 mt-3">
                                  <input
                                    type="text"
                                    value={comments[item.id] ?? ''}
                                    onChange={e =>
                                      setComments(prev => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    onKeyDown={e => e.key === 'Enter' && handleCommentSubmit(item)}
                                    placeholder={LABELS.placeholder[l]}
                                    maxLength={500}
                                    className="flex-1 text-xs border border-bone rounded-lg px-3 py-2 bg-surface outline-none focus:border-gold text-charcoal placeholder:text-mist"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCommentSubmit(item)}
                                    disabled={sending.has(item.id)}
                                    className="shrink-0 text-xs px-3 py-2 rounded-lg bg-gold text-white hover:bg-gold-dark transition-colors disabled:opacity-50"
                                  >
                                    {LABELS.submit[l]}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
