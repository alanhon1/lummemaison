'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, EyeOff, Eye, CheckCheck } from 'lucide-react';
import { addOrderMessage } from '@/app/manzura/orders/actions';

interface MessageRow {
  id: string;
  sender_role: 'admin' | 'customer';
  body: string;
  is_internal: boolean;
  created_at: string;
}

export default function AdminOrderMessages({
  orderId,
  messages,
  lastMessageSeenAt,
}: {
  orderId: number;
  messages: MessageRow[];
  lastMessageSeenAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addOrderMessage(orderId, body, isInternal);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody('');
      setIsInternal(false);
      router.refresh();
    });
  }

  return (
    <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
      <h2 className="font-display text-lg text-charcoal mb-4">Messages</h2>

      {messages.length === 0 ? (
        <p className="text-sm text-mist italic mb-5">No messages yet.</p>
      ) : (
        <ul className="space-y-3 mb-6">
          {messages.map(m => {
            const showReceipt = m.sender_role === 'admin' && !m.is_internal;
            const seen = showReceipt && !!lastMessageSeenAt && new Date(lastMessageSeenAt) >= new Date(m.created_at);
            return (
            <li
              key={m.id}
              className={`border-l-2 pl-4 py-1 ${
                m.is_internal
                  ? 'border-amber-400 bg-amber-50/50 rounded-r'
                  : m.sender_role === 'admin'
                  ? 'border-gold/40'
                  : 'border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-mist mb-1">
                <span className={m.sender_role === 'admin' ? 'text-gold-dark' : 'text-stone-600'}>
                  {m.sender_role}
                </span>
                {m.is_internal && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <EyeOff size={11} />
                    Internal
                  </span>
                )}
                <span className="ml-auto text-mist normal-case tracking-normal">
                  {new Date(m.created_at).toLocaleString()}
                </span>
                {showReceipt && (
                  <span
                    className={`normal-case tracking-normal inline-flex items-center gap-0.5 ${seen ? 'text-emerald-600' : 'text-mist'}`}
                    title={seen ? 'Customer has opened the order' : 'Not yet seen by customer'}
                  >
                    <CheckCheck size={11} />
                    {seen ? 'Seen' : 'Sent'}
                  </span>
                )}
              </div>
              <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </li>
            );
          })}
        </ul>
      )}

      {/* Composer */}
      <div className="border-t border-bone pt-5">
        <label className="block text-[10px] uppercase tracking-widest text-mist mb-2">
          New message
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Write a message to the customer, or jot an internal note…"
          className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white resize-y"
        />
        <div className="flex items-center gap-3 mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-mist cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="accent-amber-600"
            />
            {isInternal ? <EyeOff size={13} /> : <Eye size={13} />}
            {isInternal ? 'Internal note (customer cannot see)' : 'Visible to customer'}
          </label>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !body.trim()}
            className="btn-gold text-xs inline-flex items-center gap-1.5 ml-auto disabled:opacity-60"
          >
            <Send size={13} />
            {pending ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-700 mt-2 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
