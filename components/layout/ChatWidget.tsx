'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send, ShoppingBag } from 'lucide-react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { localePath } from '@/lib/i18n';

type RecommendedProduct = { id: number; name: string };
type Message = { role: 'user' | 'assistant'; content: string; products?: RecommendedProduct[] };

const LIMIT_MESSAGES: Record<string, string> = {
  en: "You've reached today's limit of 15 questions. Please try again tomorrow! For urgent help, contact us at info@lumeemaison.com 💛",
  ru: 'Вы достигли дневного лимита (15 вопросов). Попробуйте снова завтра! По срочным вопросам: info@lumeemaison.com 💛',
};

const LIMIT_BANNER: Record<string, string> = {
  en: "Daily limit reached — try again tomorrow",
  ru: 'Дневной лимит исчерпан — попробуйте завтра',
};

const LAUNCHER_LABEL: Record<string, string> = {
  en: 'Chat with me! 👋',
  ru: 'Напишите мне! 👋',
};

function todayUtc() {
  return new Date().toISOString().split('T')[0];
}

export default function ChatWidget({ isLoggedIn }: { isLoggedIn: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoggedIn) {
      const stored = localStorage.getItem('lm_chat_sid');
      if (stored) {
        setSessionId(stored);
      } else {
        const id = crypto.randomUUID();
        localStorage.setItem('lm_chat_sid', id);
        setSessionId(id);
      }

      // Restore limit state for today (resets automatically on new UTC day)
      try {
        const raw = localStorage.getItem('lm_chat_limit');
        if (raw) {
          const { date } = JSON.parse(raw) as { date: string };
          if (date === todayUtc()) {
            setLimitReached(true);
          } else {
            localStorage.removeItem('lm_chat_limit');
          }
        }
      } catch {
        localStorage.removeItem('lm_chat_limit');
      }
    }
  }, [isLoggedIn]);

  // When chat opens with limit already reached and no messages, inject the notice
  useEffect(() => {
    if (open && limitReached && messages.length === 0) {
      setMessages([{ role: 'assistant', content: LIMIT_MESSAGES[locale] ?? LIMIT_MESSAGES.en }]);
    }
  }, [open, limitReached]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Let other parts of the site (FAQ, Contact) open the chat via a global event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('lumee:open-chat', handler);
    return () => window.removeEventListener('lumee:open-chat', handler);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading || limitReached) return;

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send only role + content — assistant messages also carry a `products`
        // field for the recommendation buttons, which must not be forwarded.
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      });
      const data = await res.json();

      if (data.limitReached) {
        const msg = LIMIT_MESSAGES[locale] ?? LIMIT_MESSAGES.en;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
        setLimitReached(true);
        localStorage.setItem('lm_chat_limit', JSON.stringify({ date: todayUtc() }));
      } else if (data.reply) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.reply, products: data.products as RecommendedProduct[] | undefined },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Hide on the checkout flow so the floating buttons never overlap the
  // primary CTA (Continue / Place order) on mobile.
  if (pathname.includes('/checkout')) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-surface border border-bone"
            style={{
              width: 'min(320px, calc(100vw - 48px))',
              height: 460,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-charcoal text-cream">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-cream shrink-0">
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster="/ai-assistant.png"
                    className="w-full h-full object-cover"
                  >
                    <source src="/ai-assistant-wave.mp4" type="video/mp4" />
                    <source src="/ai-assistant-wave.webm" type="video/webm" />
                  </video>
                </div>
                <span className="text-sm font-semibold tracking-wide">Lumée Maison</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-mist hover:text-cream transition-colors"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages / Login gate */}
            {isLoggedIn === false ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
                <MessageCircle size={32} className="text-gold opacity-60" />
                <p className="text-sm text-charcoal font-medium">
                  {locale === 'ru'
                    ? 'Войдите, чтобы написать нам'
                    : 'Please log in to chat with us'}
                </p>
                <Link
                  href={localePath(locale, '/account/login')}
                  className="px-5 py-2 rounded-full bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors"
                >
                  {locale === 'ru' ? 'Войти' : 'Log in'}
                </Link>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-cream">
                {messages.length === 0 && (
                  <p className="text-xs text-mist text-center mt-4 px-4">
                    Hi! 👋 Ask me anything about shipping, payment, or products.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-gold text-white rounded-br-sm'
                          : 'bg-surface text-charcoal border border-bone rounded-bl-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === 'assistant' && m.products && m.products.length > 0 && (
                      <div className="flex flex-col items-start gap-1 mt-1.5 max-w-[85%]">
                        {m.products.map(p => (
                          <Link
                            key={p.id}
                            href={localePath(locale, `/product/${p.id}`)}
                            className="text-[11px] inline-flex items-center gap-1.5 bg-gold text-white rounded-full px-3 py-1.5 hover:bg-gold-dark transition-colors"
                          >
                            <ShoppingBag size={12} className="shrink-0" />
                            <span className="line-clamp-1">{p.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface border border-bone rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                      <span className="flex gap-1.5 items-center">
                        <span className="w-2 h-2 bg-gold/80 rounded-full typing-dot" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gold/80 rounded-full typing-dot" style={{ animationDelay: '160ms' }} />
                        <span className="w-2 h-2 bg-gold/80 rounded-full typing-dot" style={{ animationDelay: '320ms' }} />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Input — only when logged in */}
            {isLoggedIn !== false && (
              limitReached ? (
                <div className="flex items-center gap-2 px-3 py-2.5 border-t border-bone bg-bone/60">
                  <span className="flex-1 text-[11px] text-mist text-center leading-tight">
                    {LIMIT_BANNER[locale] ?? LIMIT_BANNER.en}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-bone bg-surface">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    disabled={loading}
                    placeholder="Type a message…"
                    className="flex-1 text-xs bg-transparent outline-none text-charcoal placeholder:text-mist"
                  />
                  <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-white disabled:opacity-40 hover:bg-gold-dark transition-colors"
                    aria-label="Send"
                  >
                    <Send size={13} />
                  </button>
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher row: label bubble + toggle button — shrinks slightly together on hover */}
      <motion.div
        className="flex items-center gap-2"
        whileHover={{ scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <AnimatePresence>
          {!open && (
            <motion.span
              key="launcher-label"
              initial={{ opacity: 0, x: 8, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.9 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="select-none whitespace-nowrap rounded-full bg-surface border border-gold/40 shadow-md px-3 py-1.5 text-xs font-medium text-charcoal"
            >
              {LAUNCHER_LABEL[locale] ?? LAUNCHER_LABEL.en}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <button
          onClick={() => setOpen(prev => !prev)}
          className="w-14 h-14 rounded-full bg-cream border border-gold/40 overflow-hidden flex items-center justify-center shadow-lg transition-all duration-300"
          aria-label={open ? 'Close chat' : 'Open chat'}
        >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-charcoal"
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              <Image
                src="/ai-assistant.png"
                alt="Lumée Maison AI assistant"
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            </motion.span>
          )}
        </AnimatePresence>
        </button>
      </motion.div>
    </div>
  );
}
