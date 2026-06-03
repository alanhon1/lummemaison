-- Phase 4: capture per-order customer notes + a manually-applied discount code.
--
-- notes: free-form text. The checkout form caps to 500 characters; the DB
--   column is plain text so a longer paste from a customer with a different
--   client isn't truncated server-side surprisingly.
-- discount_code: shown in the admin email with a "verify manually" note.
--   We never auto-apply a discount — fulfilment runs the actual adjustment.

alter table public.orders
  add column if not exists notes text,
  add column if not exists discount_code text;
