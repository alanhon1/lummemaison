-- Admin-only product flags layered onto the existing per-product stock row.
--   wonder        : a manual admin label (purple "W"); never shown to customers.
--   stock_unknown : real stock not yet known → UI shows "???" and treats it as 0
--                   (reusing the existing 0-stock/packaging guard). Cleared when
--                   an admin sets a real number.
alter table public.product_stock
  add column if not exists wonder        boolean not null default false,
  add column if not exists stock_unknown boolean not null default false;
