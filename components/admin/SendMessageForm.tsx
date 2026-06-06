'use client';

import { useActionState } from 'react';
import { sendMessage } from '@/app/manzura/users/[user_id]/actions';

export default function SendMessageForm({ userId }: { userId: string }) {
  const boundAction = sendMessage.bind(null, userId);
  const [state, formAction, pending] = useActionState(boundAction, {});

  return (
    <section>
      <h2 className="font-display text-xl font-light text-charcoal mb-4">Send Message</h2>

      {state.ok ? (
        <div className="bg-green-50 border border-green-200 rounded-sm px-4 py-3 text-sm text-green-800">
          Message sent.
        </div>
      ) : (
        <form action={formAction} className="space-y-3 max-w-xl">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
              Subject
            </label>
            <input
              name="subject"
              type="text"
              required
              maxLength={200}
              className="w-full border border-bone bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-gold transition-colors rounded-sm"
              placeholder="e.g. Order update"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1">
              Message
            </label>
            <textarea
              name="body"
              required
              rows={5}
              className="w-full border border-bone bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-gold transition-colors rounded-sm resize-y"
              placeholder="Write your message here…"
            />
          </div>

          {state.error && (
            <p className="text-xs text-red-600" role="alert">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-gold text-sm disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </section>
  );
}
