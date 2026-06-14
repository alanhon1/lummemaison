'use client';

import { Check } from 'lucide-react';

/**
 * Small inline indicator shown next to a customer's email.
 * - verified  → blue circle + white check, tooltip "email confirmed"
 * - unverified → grey circle + "!", tooltip "email not confirmed"
 * Hovering scales it slightly (the hover effect). Labels default to English
 * (used in the admin panel); the customer-facing account page passes localized
 * labels.
 */
export default function EmailVerifiedMark({
  verified,
  confirmedLabel = 'Email confirmed',
  unconfirmedLabel = 'Email not confirmed',
}: {
  verified: boolean;
  confirmedLabel?: string;
  unconfirmedLabel?: string;
}) {
  if (verified) {
    return (
      <span
        title={confirmedLabel}
        aria-label={confirmedLabel}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white align-middle shrink-0 cursor-default transition-transform duration-150 hover:scale-125 hover:bg-blue-600"
      >
        <Check size={11} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      title={unconfirmedLabel}
      aria-label={unconfirmedLabel}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 text-gray-600 align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125 hover:bg-gray-400"
    >
      !
    </span>
  );
}
