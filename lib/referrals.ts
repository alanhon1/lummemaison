// Influencer referral links (?ref=<code>). Shared between the tracking API
// route (sets the cookie, counts the click) and createOrder (reads the cookie
// and stamps referral_code onto the order row).

export const REF_COOKIE = 'ref_code';
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, first-touch wins

// Codes are case-insensitive: normalised to lowercase everywhere. Returns null
// for anything that isn't a plausible code so junk query params never reach
// the DB or the order row.
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toLowerCase();
  return /^[a-z0-9_-]{2,64}$/.test(code) ? code : null;
}
