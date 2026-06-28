// SINGLE SOURCE OF TRUTH for the Korestetics Global bank details. Imported by
// the on-site Wise section (components/checkout/WisePaymentInfo.tsx) AND the
// order instruction email (lib/email/templates.ts). Change the account here and
// both surfaces update. Plain data — safe to import from client and server.

export interface WiseField {
  label: string; // English label (also a translation key suffix where i18n'd)
  value: string; // literal — NEVER translated
  mono?: boolean;
}

export const WISE_PAYMENT = {
  receiverName: 'KORESTETICS GLOBAL',
  bankFields: [
    { label: 'SWIFT code', value: 'IBKOKRSE', mono: true },
    { label: 'Bank name', value: 'Industrial Bank of Korea' },
    { label: 'Bank account', value: '67704136004017', mono: true },
    { label: "Receiver's name", value: 'KORESTETICS GLOBAL' },
    { label: 'Address', value: 'Songdogwahak-ro-80' },
    { label: 'City', value: 'Yeonsu-gu' },
    { label: 'State', value: 'Incheon' },
    { label: 'Country', value: 'Republic of Korea' },
    { label: 'Postal code', value: '21984', mono: true },
    { label: 'Tel', value: '+82-10-2942-7225', mono: true },
    { label: 'Email', value: 'sg@koresteticsglobal.com', mono: true },
  ] as WiseField[],
} as const;

// 6 send-instruction steps; text is i18n'd by key (checkout.wise.steps.*).
export const WISE_STEP_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

export const WISE_IMAGES = [
  { src: '/images/wise/wise-1.jpeg', captionKey: 'img1' },
  { src: '/images/wise/wise-2.jpeg', captionKey: 'img2' },
  { src: '/images/wise/wise-3.jpeg', captionKey: 'img3' },
  { src: '/images/wise/wise-4.jpeg', captionKey: 'img4' },
] as const;
