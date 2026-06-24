// Pure promo-code math — no Supabase, no 'use server', no I/O. The DB row is
// mapped to a PromoRule by the caller (checkout/actions.ts), then handed here
// together with the cart lines. Keeping it pure makes the pricing rules unit-
// testable in isolation (see scripts that exercise the MAISON15 cases) and is
// the single source of truth shared by the live preview and the authoritative
// server recompute at order creation.

export interface PromoRule {
  discountType: 'percent' | 'fixed';
  discountValue: number; // percent: 0–100, fixed: cents
  minOrderCents: number; // checked against the FULL products subtotal
  maxUses: number | null; // null = unlimited
  usedCount: number;
  active: boolean;
  expiresAt: string | null; // ISO datetime or null
  includeShipping: boolean; // discount base also includes shipping
  flatShippingCents: number | null; // null = keep normal shipping; else override
  excludeCategoryIds: string[]; // categories the % skips (but still count to minimum)
}

export interface PromoLine {
  unitCents: number;
  quantity: number;
  categoryId: string | null; // product's category id, e.g. "imported-products"
}

export interface PromoResult {
  applied: boolean; // did the code qualify and change anything?
  discountCents: number; // amount taken off (>= 0)
  shippingCents: number; // EFFECTIVE shipping to charge (override or normal)
}

function lineSubtotal(lines: PromoLine[]): number {
  return lines.reduce((s, l) => s + Math.round(l.unitCents) * Math.round(l.quantity), 0);
}

// Compute the discount + effective shipping for a code. Returns the NORMAL
// shipping and a zero discount whenever the code is missing, inactive, expired,
// used up or below its minimum — so callers can always trust result.shippingCents
// and result.discountCents directly.
export function applyPromo(
  rule: PromoRule | null,
  lines: PromoLine[],
  normalShippingCents: number,
  now: Date,
): PromoResult {
  const miss: PromoResult = { applied: false, discountCents: 0, shippingCents: normalShippingCents };
  if (!rule || !rule.active) return miss;

  if (rule.expiresAt != null && new Date(rule.expiresAt) <= now) return miss;
  if (rule.maxUses != null && rule.usedCount >= rule.maxUses) return miss;

  // The minimum is always measured against the FULL subtotal (imports included).
  const subtotal = lineSubtotal(lines);
  if (subtotal < rule.minOrderCents) return miss;

  // The % only applies to NON-excluded categories; excluded items already
  // counted toward the minimum above but are not discounted.
  const excluded = new Set(rule.excludeCategoryIds.map(c => c.toLowerCase()));
  const eligible =
    excluded.size === 0
      ? subtotal
      : lineSubtotal(lines.filter(l => !excluded.has(String(l.categoryId ?? '').toLowerCase())));

  const shipping = rule.flatShippingCents != null ? rule.flatShippingCents : normalShippingCents;
  const base = rule.includeShipping ? eligible + shipping : eligible;

  const discount =
    rule.discountType === 'percent'
      ? Math.round((base * rule.discountValue) / 100)
      : Math.min(Math.round(rule.discountValue), base);

  const applied = discount > 0 || shipping !== normalShippingCents;
  return { applied, discountCents: discount, shippingCents: shipping };
}
