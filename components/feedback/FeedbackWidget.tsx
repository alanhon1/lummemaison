'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { submitRating, attachComment } from '@/app/[locale]/checkout/confirmation/[orderNumber]/actions';

type Rating = 'up' | 'down';

interface Props {
  orderId: number;
  initial?: { id: number; rating: Rating; comment: string | null } | null;
}

// Order-completion feedback (option B): the 👍/👎 press saves the rating
// instantly; an optional comment box then appears and is attached on Submit.
// Once a rating exists it can't be changed, and once a comment is submitted the
// widget collapses to a thank-you.
export default function FeedbackWidget({ orderId, initial }: Props) {
  const t = useTranslations('feedback');
  const [rating, setRating] = useState<Rating | null>(initial?.rating ?? null);
  const [feedbackId, setFeedbackId] = useState<number | null>(initial?.id ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [savingRating, setSavingRating] = useState<Rating | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(initial?.comment));
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Rating) {
    if (rating || savingRating) return;
    setSavingRating(next);
    setError(null);
    const res = await submitRating(orderId, next);
    setSavingRating(null);
    if (!res.ok || !res.id) {
      setError(res.error ?? 'Could not save your rating.');
      return;
    }
    setRating(next);
    setFeedbackId(res.id);
  }

  async function send() {
    if (!feedbackId) return;
    setSubmittingComment(true);
    setError(null);
    const res = await attachComment(feedbackId, comment);
    setSubmittingComment(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not submit your comment.');
      return;
    }
    setSubmitted(true);
  }

  const thanks = rating === 'down' ? t('thanksBad') : t('thanksGood');

  function ratingButtonClass(which: Rating): string {
    const base = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-md border text-sm transition-colors';
    if (rating === which) return `${base} border-gold-dark bg-gold/10 text-gold-dark font-semibold`;
    if (rating) return `${base} border-bone text-mist/50 cursor-default`; // the unchosen one, greyed
    return `${base} border-bone text-charcoal hover:border-gold-dark`;
  }

  return (
    <section className="bg-white border border-bone rounded-lg p-5 md:p-6 mb-6">
      <h2 className="font-display italic text-xl text-charcoal mb-4">{t('title')}</h2>

      {submitted ? (
        <p className="text-sm text-gold-dark">{thanks}</p>
      ) : (
        <>
          <div className="flex gap-3">
            <button type="button" onClick={() => choose('up')} disabled={!!rating || savingRating !== null} className={ratingButtonClass('up')}>
              {savingRating === 'up' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
              {t('good')}
            </button>
            <button type="button" onClick={() => choose('down')} disabled={!!rating || savingRating !== null} className={ratingButtonClass('down')}>
              {savingRating === 'down' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsDown size={16} />}
              {t('bad')}
            </button>
          </div>

          {rating && (
            <div className="mt-4">
              <label className="block text-sm text-charcoal mb-2">
                {rating === 'down' ? t('promptBad') : t('promptGood')}
                <span className="text-mist"> · {t('optional')}</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full border border-bone rounded-md px-3 py-2 text-sm text-charcoal outline-none focus:border-gold transition-colors resize-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={submittingComment}
                className="btn-gold text-xs mt-3 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {submittingComment && <Loader2 size={13} className="animate-spin" />}
                {t('submit')}
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      )}
    </section>
  );
}
