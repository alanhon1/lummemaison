'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';

interface Props {
  value: string;
  // Accessible name for the button when in its idle state. Defaults to the
  // translated "Copy" string. Pass a field-specific label (e.g. "Copy account
  // number") for richer screen-reader context.
  ariaLabel?: string;
}

export default function CopyButton({ value, ariaLabel }: Props) {
  const t = useTranslations('checkout.payment');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts or when permission is
      // denied. Surface no error — the value is already visible on screen
      // and the user can select-copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-mist hover:text-gold-dark p-1.5 rounded-md transition-colors"
      aria-label={ariaLabel ?? t('copy')}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? t('copied') : ''}
      </span>
    </button>
  );
}
