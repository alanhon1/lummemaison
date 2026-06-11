'use client';

import { useState } from 'react';
import { Printer, Copy, Check } from 'lucide-react';

// Copy-to-clipboard + Print buttons for the "To Order" list. The copy text is
// built server-side (a clean "name ×qty" list) and passed in, so a supplier
// message is one tap away.
export default function ProcurementActions({ copyText }: { copyText: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase px-3 py-2 rounded-md border border-bone text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy list'}
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase px-3 py-2 rounded-md border border-bone text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
      >
        <Printer size={14} />
        Print
      </button>
    </div>
  );
}
