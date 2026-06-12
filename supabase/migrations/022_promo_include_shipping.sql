-- 022: Per-promo option for whether the discount includes shipping.
--
-- Default false = the existing behaviour: the discount applies to the products
-- subtotal only and shipping is never discounted. When true, the discount base
-- is subtotal + shipping (so a percent code also takes a cut off shipping).
--
-- The discount is always recomputed server-side at checkout from this column
-- (app/[locale]/checkout/actions.ts → promoDiscountCents), so existing codes are
-- unaffected.

alter table public.promo_codes
  add column if not exists include_shipping boolean not null default false;
