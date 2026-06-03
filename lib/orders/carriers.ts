// Carrier → label + tracking-URL template. Used by the customer Account
// order-detail page and the admin "mark as shipped" form.
//
// Keep the set small and explicit — if a new carrier is needed, add it here.

export type CarrierKey = 'fedex' | 'ems' | 'dhl';

interface Carrier {
  label: string;
  trackUrl: (trackingNumber: string) => string;
}

export const CARRIERS: Record<CarrierKey, Carrier> = {
  fedex: {
    label: 'FedEx',
    trackUrl: n => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  },
  ems: {
    label: 'EMS (Korea Post)',
    trackUrl: n => `https://service.epost.go.kr/trace.RetrieveEngEms.postal?ems_gubun=E&POST_CODE=${encodeURIComponent(n)}`,
  },
  dhl: {
    label: 'DHL',
    trackUrl: n => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
  },
};

export function isCarrierKey(s: string | null | undefined): s is CarrierKey {
  return s === 'fedex' || s === 'ems' || s === 'dhl';
}

export function carrierLabel(key: string | null | undefined): string {
  if (!key) return '';
  if (isCarrierKey(key)) return CARRIERS[key].label;
  return key; // fall through for any future free-form carrier value
}

export function carrierTrackUrl(key: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!key || !trackingNumber) return null;
  if (!isCarrierKey(key)) return null;
  return CARRIERS[key].trackUrl(trackingNumber);
}
