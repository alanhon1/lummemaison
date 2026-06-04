'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Send, CheckCircle2 } from 'lucide-react';
import { sendContactMessage, type ContactState } from '@/app/[locale]/contact/actions';

const initialState: ContactState = {};

export default function ContactForm() {
  const t = useTranslations('contact');
  const [state, formAction, pending] = useActionState(sendContactMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once a message goes through.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <>
      <h2 className="font-display text-2xl font-light mb-8">Send a Message</h2>

      {state.ok ? (
        <div className="bg-white border border-gold/30 rounded-md p-6 flex items-start gap-3">
          <CheckCircle2 size={20} className="text-gold-dark shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-charcoal">Message sent</p>
            <p className="text-sm text-mist mt-1">Thank you — we&apos;ll get back to you by email shortly.</p>
          </div>
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                {t('form.name')}
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                {t('form.email')}
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
                placeholder="your@email.com"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
              {t('form.company')}
            </label>
            <input
              name="company"
              type="text"
              className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
              placeholder="Clinic / Company Name"
            />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
              {t('form.message')}
            </label>
            <textarea
              name="message"
              rows={5}
              required
              className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white resize-none"
              placeholder="Tell us about your requirements..."
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-gold w-full gap-2 disabled:opacity-60"
          >
            <Send size={15} />
            {pending ? 'Sending…' : `${t('form.send')}`}
          </button>
        </form>
      )}
    </>
  );
}
