// Checkout draft state — kept in localStorage between the four checkout steps
// so a refresh doesn't reset progress, but never persisted to the server until
// the customer confirms the order on the payment step.

const STORAGE_KEY = 'lumee_checkout_draft';

export interface ShippingSnapshot {
  fullName: string;
  email: string;
  phone: string;
  country: string;            // ISO-3166 alpha-2
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  fedexAccount: string;       // empty string if not provided
  notes: string;              // free-form per-order request, empty if none
  discountCode: string;       // empty string if none provided (manual review)
}

export interface DisclaimerAcceptance {
  shipping: boolean;
  delivery: boolean;
  stock: boolean;
  temperatureSensitive: boolean;
  fragileItems: boolean;
  acceptedAt: string;         // ISO datetime, set once all are true
}

export interface CheckoutDraft {
  shipping?: ShippingSnapshot;
  disclaimers?: DisclaimerAcceptance;
}

export function readDraft(): CheckoutDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : {};
  } catch {
    return {};
  }
}

export function writeDraft(patch: Partial<CheckoutDraft>) {
  if (typeof window === 'undefined') return;
  const current = readDraft();
  const next = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// A FedEx account number is exactly 9 digits. Anything else (blank, an email,
// letters, wrong length) is NOT a valid account — critical for shipping pricing
// below, where any non-empty value used to wrongly unlock the $35 rate.
const FEDEX_ACCOUNT_RE = /^\d{9}$/;
export function isValidFedexAccount(value: string): boolean {
  return FEDEX_ACCOUNT_RE.test(value.trim());
}

// Destinations that FedEx treats as domestic US: the mainland plus the five
// inhabited US territories. They all require a US FedEx account number, so they
// price as US — NOT at the $35 international flat rate. Each is a distinct
// ISO-3166 alpha-2 code and appears as its own entry in the checkout country
// list, which is why they silently fell through to $35 before.
//   PR Puerto Rico · GU Guam · VI US Virgin Islands
//   AS American Samoa · MP Northern Mariana Islands
// UM (US Minor Outlying Islands) is deliberately excluded — uninhabited, no
// real deliveries.
export const US_SHIPPING_ZONE = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);

// True when the destination prices and validates as a US address. Single source
// of truth — shipping cost, the FedEx-account field's visibility, its validation
// and its persistence all key off this, so a territory can never be US for one
// and international for another.
export function isUsShippingZone(country: string): boolean {
  return US_SHIPPING_ZONE.has(country);
}

// Shipping cost in cents. The US zone without a VALID 9-digit FedEx account is
// $65; everyone else (incl. the US zone with a valid FedEx account) is $35 flat.
// Validity is checked with isValidFedexAccount so junk like an email can never
// drop a US order from $65 to $35.
export function computeShippingCents(shipping: ShippingSnapshot): number {
  if (isUsShippingZone(shipping.country) && !isValidFedexAccount(shipping.fedexAccount)) {
    return 6500;
  }
  return 3500;
}
