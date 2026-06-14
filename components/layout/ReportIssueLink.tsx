'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { X, AlertCircle } from 'lucide-react';
import { reportIssue, type ReportState } from '@/app/[locale]/report/actions';

const initialState: ReportState = {};

// "Report an issue" entry point. Two variants:
//   • 'link'     — a small inline text link (legacy footer placement)
//   • 'floating' — a fixed circular button pinned bottom-right, site-wide
// Both open the same modal (message required, email optional) which posts to the
// reportIssue server action; on success we swap the form for a thank-you note.
export default function ReportIssueLink({ variant = 'link' }: { variant?: 'link' | 'floating' }) {
  const t = useTranslations('report');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportIssue, initialState);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Hide the floating button during checkout so it never overlaps the primary
  // CTA (Continue / Place order) on mobile.
  if (variant === 'floating' && pathname.includes('/checkout')) return null;

  return (
    <>
      {variant === 'floating' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('trigger')}
          title={t('trigger')}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-charcoal text-cream shadow-lg flex items-center justify-center hover:bg-gold-dark hover:scale-110 transition-all duration-300 [touch-action:manipulation]"
        >
          <AlertCircle size={24} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-cream/40 hover:text-gold transition-colors [touch-action:manipulation]"
        >
          {t('trigger')}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
          style={{ background: 'rgba(10, 10, 10, 0.72)', backdropFilter: 'blur(2px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-issue-title"
          onClick={e => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-md bg-cream text-charcoal rounded-lg shadow-2xl p-6 md:p-7">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              className="absolute top-3 right-3 text-mist hover:text-charcoal transition-colors [touch-action:manipulation]"
            >
              <X size={18} />
            </button>

            {state.ok ? (
              <div className="py-4 text-center">
                <p className="font-display italic text-xl text-charcoal mb-2">{t('successTitle')}</p>
                <p className="text-sm text-mist mb-6">{t('successBody')}</p>
                <button type="button" onClick={() => setOpen(false)} className="btn-gold">
                  {t('done')}
                </button>
              </div>
            ) : (
              <>
                <h2 id="report-issue-title" className="font-display italic text-xl text-charcoal mb-1">
                  {t('title')}
                </h2>
                <p className="text-sm text-mist mb-5">{t('subtitle')}</p>

                <form action={formAction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
                      {t('messageLabel')}
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      maxLength={4000}
                      placeholder={t('messagePlaceholder')}
                      className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors resize-y min-h-[110px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
                      {t('emailLabel')}
                      <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-mist">
                        {t('optional')}
                      </span>
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      maxLength={200}
                      placeholder={t('emailPlaceholder')}
                      className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
                    />
                  </div>

                  {state.error && <p className="text-sm text-red-600">{state.error}</p>}

                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-gold w-full disabled:opacity-60"
                  >
                    {pending ? t('submitting') : t('submit')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
