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
