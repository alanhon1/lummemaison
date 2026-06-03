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

// Shipping cost in cents. USA without a FedEx account is $65; everyone
// else (incl. USA with FedEx account) is $35 flat.
export function computeShippingCents(shipping: ShippingSnapshot): number {
  if (shipping.country === 'US' && !shipping.fedexAccount.trim()) {
    return 6500;
  }
  return 3500;
}
