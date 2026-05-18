/**
 * Shared fuzzy product-name matching used by aesthetics-shop and gofillerss
 * scrapers and by group-products. One canonical implementation.
 */

/** Lowercase and strip noise (parens, "units", punctuation, etc). */
export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(\d+)\s*u\b/g, '$1')
    .replace(/\bunits?\b/g, '')
    .replace(/\bwith\b/g, '')
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score how many normalised words two names share. Long words count double. */
export function scoreMatch(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = b.split(' ').filter(w => w.length > 1);
  let score = 0;
  for (const w of wb) {
    if (wa.has(w)) score += w.length > 3 ? 2 : 1;
  }
  return score;
}

/**
 * Extract the brand prefix from a raw (un-normalised) product name.
 * Returns the first contiguous-uppercase token of length >= 4, lowercased.
 *
 *   "VOM LIGHT (CE) NO Lidocaine" → "vom" ... wait — "VOM" is 3 chars, so it returns
 *     the next qualifying token. "VOM LIGHT" → "light".
 *
 * Adjusts: we want "VOM" specifically. So use length >= 3 here (brands like "VOM",
 * "PCL", "PRP" are real). Stoplist filters out generic words.
 */
const BRAND_STOPLIST = new Set([
  'CE', 'NO', 'WITH', 'PLUS', 'NEW', 'FOR', 'AND', 'THE', 'FROM',
  'INJ', 'TAB', 'BOX', 'SET', 'KIT', 'GEL', 'PEN', 'PAD',
]);

export function extractBrandPrefix(rawName: string): string | null {
  const stripped = rawName.replace(/\(.*?\)/g, ' ').trim();
  const toks = stripped.split(/\s+/);
  for (const t of toks) {
    // Allow letters, digits, hyphen — must start with letter or digit.
    if (!/^[A-Z0-9][A-Z0-9-]*$/.test(t)) continue;
    if (t.length < 3) continue;
    if (BRAND_STOPLIST.has(t)) continue;
    return t.toLowerCase();
  }
  return null;
}

/**
 * Strict match: returns scoreMatch result only when both names share the
 * same brand prefix. Otherwise returns 0. This prevents cross-brand
 * false positives like VOM LIGHT being matched to a REGENOVUE entry.
 */
export function strictScoreMatch(rawA: string, normA: string, rawB: string, normB: string): number {
  const brandA = extractBrandPrefix(rawA);
  const brandB = extractBrandPrefix(rawB);
  if (!brandA || !brandB) return 0;
  // Brand prefix from A must appear as a token in B's normalised form (or vice versa).
  const tokensB = new Set(normB.split(' '));
  const tokensA = new Set(normA.split(' '));
  if (!tokensB.has(brandA) && !tokensA.has(brandB)) return 0;
  return scoreMatch(normA, normB);
}

/**
 * Variant markers — tokens that distinguish sibling SKUs within a brand.
 * Used by variantStrictScoreMatch to reject cross-variant matches
 * (e.g. REGENOVUE DEEP vs REGENOVUE DEEP PLUS).
 */
// normalise() replaces "plus" with "+" — both forms tracked here.
const VARIANT_MARKERS = new Set([
  'fine', 'deep', 'sub', 'subq', 'volume', 'shape', 'kiss', 'soft', 'hard',
  'implant', 'grand', 'light', 'intense', 'meso', 'plus', '+',
  'gold', 'silver',
]);

function variantTokens(norm: string): Set<string> {
  const out = new Set<string>();
  for (const t of norm.split(' ')) {
    if (VARIANT_MARKERS.has(t)) out.add(t);
  }
  return out;
}

/**
 * Variant-strict match: brand-strict + the candidate's variant marker set
 * must equal the product's variant marker set. Returns 0 if either fails.
 *
 * Catches cases the brand-strict matcher misses, e.g.:
 *   "REGENOVUE DEEP"      variant set = {deep}
 *   "REGENOVUE DEEP PLUS" variant set = {deep, plus} → reject
 */
export function variantStrictScoreMatch(rawA: string, normA: string, rawB: string, normB: string): number {
  const base = strictScoreMatch(rawA, normA, rawB, normB);
  if (base === 0) return 0;
  const va = variantTokens(normA);
  const vb = variantTokens(normB);
  if (va.size !== vb.size) return 0;
  for (const t of va) if (!vb.has(t)) return 0;
  return base;
}
