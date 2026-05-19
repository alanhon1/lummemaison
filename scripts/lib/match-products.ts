import type { TxtEntry } from './parse-products-txt';

export interface JsonProduct {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  [k: string]: unknown;
}

export interface MatchResult {
  matches: Array<{ product: JsonProduct; entry: TxtEntry; reason: 'similarity' | 'ordinal' }>;
  unmatchedProducts: JsonProduct[];
  unmatchedEntries: TxtEntry[];
  perCategoryReport: Array<{ categoryId: string; productCount: number; entryCount: number; matched: number }>;
}

const BROKEN_PATTERNS: RegExp[] = [
  /^Product \d+$/,        // pure placeholder
  /^[A-Z]\.?$/,           // single capital, e.g. "C"
  /^[A-Za-z]{1,3}$/,      // 1-3 char fragments e.g. "Fere", "JBP"
];

export function isBrokenName(name: string): boolean {
  return BROKEN_PATTERNS.some(re => re.test(name.trim()));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')     // drop parenthesised qualifiers
    .replace(/[^a-z0-9]+/g, ' ')   // collapse non-alphanum
    .replace(/\b(plus|ce|lidocaine|with|no)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function prefixOverlap(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const limit = Math.min(na.length, nb.length);
  let i = 0;
  while (i < limit && na[i] === nb[i]) i++;
  return i;
}

export function matchByCategoryThenOrdinal(
  products: JsonProduct[],
  entries: TxtEntry[],
): MatchResult {
  const matches: MatchResult['matches'] = [];
  const perCategoryReport: MatchResult['perCategoryReport'] = [];
  const unmatchedProducts: JsonProduct[] = [];
  const unmatchedEntries: TxtEntry[] = [];

  const categoryIds = new Set<string>([...products.map(p => p.categoryId), ...entries.map(e => e.categoryId)]);

  for (const categoryId of categoryIds) {
    const catProducts = products.filter(p => p.categoryId === categoryId);
    const catEntries = entries.filter(e => e.categoryId === categoryId);

    const productClaimed = new Set<number>();   // by id
    const entryClaimed = new Set<number>();     // by index in catEntries

    // Pass 1 — similarity, only for products with non-broken names.
    // Exact normalized-equality wins regardless of length; otherwise require ≥ 4 prefix-overlap chars.
    for (const p of catProducts) {
      if (isBrokenName(p.name)) continue;
      const np = normalize(p.name);
      let bestIdx = -1;
      let bestScore = 0;
      let exactIdx = -1;
      for (let i = 0; i < catEntries.length; i++) {
        if (entryClaimed.has(i)) continue;
        const ne = normalize(catEntries[i].name);
        if (np.length > 0 && np === ne) { exactIdx = i; break; }
        const score = prefixOverlap(p.name, catEntries[i].name);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      const winnerIdx = exactIdx !== -1 ? exactIdx : (bestScore >= 4 ? bestIdx : -1);
      if (winnerIdx >= 0) {
        matches.push({ product: p, entry: catEntries[winnerIdx], reason: 'similarity' });
        productClaimed.add(p.id);
        entryClaimed.add(winnerIdx);
      }
    }

    // Pass 2 — ordinal pairing for leftover broken + placeholders.
    const remainingProducts = catProducts.filter(p => !productClaimed.has(p.id));
    const remainingEntries = catEntries.map((e, i) => ({ e, i })).filter(x => !entryClaimed.has(x.i));
    const pairCount = Math.min(remainingProducts.length, remainingEntries.length);
    for (let k = 0; k < pairCount; k++) {
      matches.push({
        product: remainingProducts[k],
        entry: remainingEntries[k].e,
        reason: 'ordinal',
      });
      productClaimed.add(remainingProducts[k].id);
      entryClaimed.add(remainingEntries[k].i);
    }

    for (const p of catProducts) if (!productClaimed.has(p.id)) unmatchedProducts.push(p);
    catEntries.forEach((e, i) => { if (!entryClaimed.has(i)) unmatchedEntries.push(e); });

    perCategoryReport.push({
      categoryId,
      productCount: catProducts.length,
      entryCount: catEntries.length,
      matched: matches.filter(m => m.product.categoryId === categoryId).length,
    });
  }

  return { matches, unmatchedProducts, unmatchedEntries, perCategoryReport };
}
