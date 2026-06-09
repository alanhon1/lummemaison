'use client';

import { MessageCircle } from 'lucide-react';

/**
 * Opens the global AI ChatWidget by dispatching a window event that
 * ChatWidget listens for. Lets server components (FAQ, Contact) trigger
 * the chat without sharing React state.
 */
export default function OpenChatButton({
  label,
  className,
  withIcon = false,
}: {
  label: string;
  className?: string;
  withIcon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('lumee:open-chat'))}
      className={className}
    >
      {withIcon && <MessageCircle size={15} className="shrink-0" />}
      {label}
    </button>
  );
}
