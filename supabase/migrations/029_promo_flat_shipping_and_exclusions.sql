-- 029: Bulk-discount support for promo codes — flat shipping override and
-- category exclusions. Both are recomputed server-side at checkout
-- (app/[locale]/checkout/actions.ts → lib/checkout/promo.ts), so existing codes
-- are unaffected: NULL flat_shipping keeps the normal $35/$65 rule, and an empty
-- exclude list discounts the whole subtotal exactly as before.

alter table public.promo_codes
  -- NULL = keep the normal computed shipping; a value (cents) overrides it.
  add column if not exists flat_shipping_cents integer,
  -- Category ids the % must NOT discount. Excluded items STILL count toward
  -- min_order_cents — they just don't receive the percentage off.
  add column if not exists exclude_category_ids text[] not null default '{}';

-- Public bulk code: 15% off + flat $100 shipping, only at $2,500+, and the 15%
-- skips the thin-margin Imported Products (Restylane/Botox/etc.) whose value
-- still counts toward the $2,500 minimum.
insert into public.promo_codes
  (code, description, discount_type, discount_value, min_order_cents,
   include_shipping, flat_shipping_cents, exclude_category_ids, active)
values
  ('MAISON15', 'Bulk: 15% off (excl. imports) + flat $100 shipping at $2,500+',
   'percent', 15, 250000, false, 10000, array['imported-products'], true)
on conflict (code) do update set
  description         = excluded.description,
  discount_type       = excluded.discount_type,
  discount_value      = excluded.discount_value,
  min_order_cents     = excluded.min_order_cents,
  include_shipping    = excluded.include_shipping,
  flat_shipping_cents = excluded.flat_shipping_cents,
  exclude_category_ids = excluded.exclude_category_ids,
  active              = excluded.active;
