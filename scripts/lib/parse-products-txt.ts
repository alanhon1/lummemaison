import fs from 'node:fs';

export interface TxtEntry {
  categoryId: string;     // e.g. "fillers"
  name: string;           // before " — "
  spec: string;           // after " — " (may be empty)
  rawLine: string;        // for debugging
  lineNumber: number;     // 1-based
}

// Maps the `(N) DISPLAY NAME (#X-Y)` header text to the products.json categoryId.
// Keep this in sync with data/products.json `categories[].id`.
const CATEGORY_NAME_TO_ID: ReadonlyArray<{ matcher: RegExp; id: string }> = [
  { matcher: /^FILLERS\b/i,                                        id: 'fillers' },
  { matcher: /^MESOTHERAPY\b/i,                                    id: 'mesotherapy' },
  { matcher: /^ACNE\b/i,                                           id: 'acne-treatment' },
  { matcher: /^HAIR\b/i,                                           id: 'hair-treatment' },
  { matcher: /^PHARMACY\b/i,                                       id: 'pharmacy-favourites' },
  { matcher: /^TOPICAL\b/i,                                        id: 'topical-cosmetics' },
  { matcher: /^INTIMATE\b/i,                                       id: 'intimate-care' },
  { matcher: /^GROWTH\b/i,                                         id: 'growth-factor-exosome' },
  { matcher: /^CURENEX\b/i,                                        id: 'curenex' },
  { matcher: /^DERMAGEN\b/i,                                       id: 'dermagen' },
  { matcher: /^GTM\b/i,                                            id: 'gtm' },
  { matcher: /^EQUIPMENT\b/i,                                      id: 'equipment' },
  { matcher: /^SALON\b/i,                                          id: 'salon-grade' },
  { matcher: /^LIPOLYTIC/i,                                        id: 'lipolytics' },
  { matcher: /^BOTULINUM\b/i,                                      id: 'botulinum' },
  { matcher: /^INJECTIONS?\b/i,                                    id: 'injections' },
  { matcher: /^ANESTHETIC/i,                                       id: 'anesthetics' },
  { matcher: /^PLACENTAL\b/i,                                      id: 'placental-therapy' },
  { matcher: /^NANO\b/i,                                           id: 'nano-needle-cannula' },
  { matcher: /^IMPORTED\b/i,                                       id: 'imported-products' },
];

const HEADER_RE = /^\(\d+\)\s+(.+?)\s*\(#\d+-\d+\)\s*$/;
const DASH_RE = /\s+[—-]\s+/;

export function parseProductsTxt(file: string): TxtEntry[] {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/);
  const out: TxtEntry[] = [];
  let currentCategoryId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const headerMatch = HEADER_RE.exec(line);
    if (headerMatch) {
      const displayName = headerMatch[1].trim();
      const found = CATEGORY_NAME_TO_ID.find(c => c.matcher.test(displayName));
      currentCategoryId = found ? found.id : null;
      continue;
    }

    if (!currentCategoryId) continue;

    // An entry must have a recognised separator (em dash or hyphen surrounded by spaces).
    const parts = line.split(DASH_RE);
    if (parts.length < 2) {
      // No separator: still a product, just no spec. Common for short notes lines.
      out.push({
        categoryId: currentCategoryId,
        name: line,
        spec: '',
        rawLine: line,
        lineNumber: i + 1,
      });
      continue;
    }
    const name = parts[0].trim();
    const spec = parts.slice(1).join(' — ').trim();
    out.push({
      categoryId: currentCategoryId,
      name,
      spec,
      rawLine: line,
      lineNumber: i + 1,
    });
  }
  return out;
}
